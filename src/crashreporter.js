const { crashReporter } = require('electron');

module.exports = {
  // Crash reporter needs to be initialized on every thread it's used on.
  // TODO: figure out why native crashes don't get metadata
  // (which is also what happens result if you don't init the reporter on every thread).
  start(isRelease) {
    let crashServer = 'http://crashes.rylo.com:1127/post';
    if (!isRelease) {
      crashServer = 'http://localhost:1127/post';
    }
    crashReporter.start({
      productName: 'Aurora',
      companyName: 'Rylo',
      submitURL: crashServer,
      uploadToServer: true,
    });
  },
};
