import BB from "bitbucket";
import minimist from "minimist";
import { updatePackageJsonPackageVersion } from "./utils.js";
import * as dotenv from "dotenv";

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

const bitbucket = new Bitbucket({
  auth,
  request: {
    timeout: 5000,
  },
});

const repositoryDetails = { repo_slug: repoSlug, workspace };

// Get hash of last commit for given branch
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
  throw `Cannot retreive last commit information for ${workspace}/${repoSlug} on ${branch}, make sure that selected branch exists and you have access read selected repository.`;
}

// Get content of package.json
const { data: fileContent } = await bitbucket.repositories.readSrc({
  ...repositoryDetails,
  path: packageJsonPath,
  commit,
});

// Update the content of package.json
const oldVersion = JSON.parse(fileContent).dependencies[packageName]; // could be better
if (oldVersion === undefined)
  throw `Package ${packageName} not found in ${packageJsonPath}`;

const content = updatePackageJsonPackageVersion(
  fileContent,
  packageName,
  version
);
const newBranch = `update-${packageName}-${version}`;
const message = `Update version of package ${packageName} from ${oldVersion} to ${version}`;
await bitbucket.repositories.createSrcFileCommit({
  ...repositoryDetails,
  [packageJsonPath]: content,
  author,
  message,
  branch: newBranch,
});

// Create a pull request
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
console.log(
  `Pull request #${id} ${message} created\nCheck out: ${pullRequestLink}`
);
