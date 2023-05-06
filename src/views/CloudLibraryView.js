const m = require('mithril');

let remoteImgs = [];

module.exports = {
  oninit() {
    return m.request({
      method: "GET",
      url: "https://services.rylo.com/api/v1/u/storage/list",
      withCredentials: true,
    })
    .then(function (data) {
      remoteImgs = data.files.map(a => `https://services.rylo.com/api/v1/u/storage/thumbnail?file_uuid=${a.fileUuid}`);
    })
    .catch(function (e) {
      console.log(e);
    });
  },
  view() {
    return m('#library-cloud', remoteImgs.map(img => m('img', {src: img})));
  }
};
