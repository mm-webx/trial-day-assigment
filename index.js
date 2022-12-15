import BB from "bitbucket";
import minimist from "minimist";
import { updatePackageJsonPackageVersion } from "./utils.js";
import * as dotenv from "dotenv";
import winston, { format } from "winston";
import util from "util";

function transform(info, opts) {
  const args = info[Symbol.for("splat")];
  if (args) {
    info.message = util.format(info.message, ...args);
  }
  return info;
}

function utilFormatter() {
  return { transform };
}

const consoleTransport = new winston.transports.Console({
  colorize: true,
  level: "silly",
  silent: false,
  handleExceptions: false,
  timestamp: true,
});

const logger = new winston.createLogger({
  transports: [consoleTransport],
  defaultMeta: { service: "update-package-json" },
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    utilFormatter(), // <-- this is what changed
    format.colorize(),
    format.printf(
      ({ level, message, label, timestamp }) =>
        `${timestamp} ${label || "-"} ${level}: ${message}`
    )
  ),
});

process.on("unhandledRejection", (error) => {
  logger.error(error);
  throw error;
});

process.on("uncaughtException", (error) => {
  logger.error(error);
  process.exit(0);
});

dotenv.config();
const { Bitbucket } = BB;
const argv = minimist(process.argv.slice(2));

const packageName = argv.packageName;
const version = argv.version;
const workspace = argv.workspace;
const repoSlug = argv.repoSlug;

if (typeof packageName !== "string" || !packageName)
  throw "You must provide packageName parameter";
if (typeof version !== "string" || !version)
  throw "You must provide version parameter";
if (typeof workspace !== "string" || !workspace)
  throw "You must provide workspace parameter";
if (typeof repoSlug !== "string" || !repoSlug)
  throw "You must provide repoSlug parameter";

const branch = argv.branch || "master";
const author = argv.author || "Update Script <noreply@redocly.com>";
const packageJsonPath = argv.packageJsonPath || "package.json";

// Authenticate to the BitBucket API
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const token = process.env.TOKEN;
const auth = username && password ? { username, password } : { token };

logger.defaultMeta = {
  ...logger.defaultMeta,
  argv: process.argv,
  args: argv,
  env: {
    username,
    password,
    token,
  },
};

const bitbucket = new Bitbucket({
  auth,
  request: {
    timeout: 5000,
  },
});

const repositoryDetails = { repo_slug: repoSlug, workspace };

// Get hash of last commit for given branch
logger.info(
  `Obtaining last commit hash from ${workspace}/${repoSlug} on ${branch}...`,
  { auth }
);
const {
  data: { values: listCommits },
} = await bitbucket.repositories.listCommits({
  ...repositoryDetails,
  pagelen: 1,
  include: branch,
});

try {
  var commit = listCommits[0].hash;
} catch (e) {
  console.error(e, { listCommits });
  throw `Cannot retreive last commit information for ${workspace}/${repoSlug} on ${branch}, make sure that selected branch exists and you have access read selected repository.`;
}

// Get content of package.json
logger.info(
  `Obtaining ${packageJsonPath} content from ${workspace}/${repoSlug}/${branch}/${commit}...`
);
const { data: fileContent } = await bitbucket.repositories.readSrc({
  ...repositoryDetails,
  path: packageJsonPath,
  commit,
});

// Update the content of package.json
logger.info(
  `Updating package ${packageName} to version ${version} ${packageJsonPath}`
);
const oldVersion = JSON.parse(fileContent).dependencies[packageName]; // could be better
if (oldVersion === undefined) {
  console.error(`Package ${packageName} not found in ${packageJsonPath}`, {
    fileContent,
  });
  throw `Package ${packageName} not found in ${packageJsonPath}`;
}

const content = updatePackageJsonPackageVersion(
  fileContent,
  packageName,
  version
);
const newBranch = `update-${packageName}-${version}`;
const message = `Update version of package ${packageName} from ${oldVersion} to ${version}`;

logger.info(`Creating new branch ${workspace}/${repoSlug} on ${newBranch}...`, {
  content,
});
await bitbucket.repositories.createSrcFileCommit({
  ...repositoryDetails,
  [packageJsonPath]: content,
  author,
  message,
  branch: newBranch,
});

// Create a pull request
logger.info(`Create pull request ${newBranch}: ${message}...`);
const {
  data: { id },
} = await bitbucket.repositories.createPullRequest({
  ...repositoryDetails,
  title: message,
  source: {
    branch: {
      name: newBranch,
    },
  },
  destination: {
    branch: {
      name: "master",
    },
  },
});

// Output
const pullRequestLink = `https://bitbucket.org/${workspace}/${repoSlug}/pull-requests/${id}`; // could be better
logger.info(
  `Pull request #${id} ${message} created\nCheck out: ${pullRequestLink}`,
  { pullRequestLink, id }
);
