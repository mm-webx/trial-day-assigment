import { format, check } from "prettier-package-json";

export const updatePackageJsonPackageVersion = (
  packageJsonContent,
  packageName,
  version
) => {
  // Parse the file content as JSON
  const packageJson = JSON.parse(packageJsonContent);

  if (packageJson.dependencies[packageName] === undefined)
    throw `Package ${packageName} not found`;

  // Update the version of the package
  packageJson.dependencies[packageName] = version;

  // Proper formating
  const content = format(packageJson, {});
  // We want to be sure that file is still valid
  check(content, {});

  return content;
};
