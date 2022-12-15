import assert from "assert";
import { updatePackageJsonPackageVersion } from "../utils.js";

const pj = JSON.stringify({
  name: "trial-day-assignment",
  version: "0.0.1",
  description:
    "Script which updates package.json in BitBucket repo and opens a pull request",
  main: "index.js",
  author: "MM",
  license: "MIT",
  private: true,
  scripts: {
    test: "mocha",
  },
  dependencies: {
    bitbucket: "^2.9.0",
    dotenv: "^16.0.3",
    minimist: "^1.2.7",
    "prettier-package-json": "^2.7.0",
  },
  type: "module",
  devDependencies: {
    mocha: "^10.2.0",
    nyc: "^15.1.0",
  },
});

describe("Package Json Update", function () {
  describe("#update", function () {
    it("should return updated version of given package", function () {
      const content = updatePackageJsonPackageVersion(
        pj,
        "bitbucket",
        "^3.0.1"
      );
      assert.equal(JSON.parse(content).dependencies["bitbucket"], "^3.0.1");
    });
  });
  describe("#not exists", function () {
    it("should return an error", function () {
      assert.throws(
        () => {
          updatePackageJsonPackageVersion(pj, "dontknow", "^3.0.1");
        },
        (e) => e === "Package dontknow not found"
      );
    });
  });
});
