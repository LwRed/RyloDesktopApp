const { remote } = require('electron');

let isRelease = true;

module.exports = {
  setIsReleaseBuild(isReleaseBuild) {
    isRelease = isReleaseBuild;
  },

  isReleaseBuild() {
    return remote ? isRelease : !process.defaultApp;
  },
};
