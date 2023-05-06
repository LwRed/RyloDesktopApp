const m = require('mithril');
const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

function replaceExtension(filePath, ext) {
  const p = path.parse(filePath);
  delete p.base;
  p.ext = ext;
  return path.format(p);
}

// throws an error if the src or dst cannot be read/written
function copyFile(src, dst, progressCallback, onCompletion) {
  try {
    const stat = fs.statSync(src);
    const fileSize = stat.size;
    const readStream = fs.createReadStream(src);
    const writeStream = fs.createWriteStream(dst);

    let didFinish = false;
    let bytesCopied = 0;
    readStream.on('data', (buffer) => {
      bytesCopied += buffer.length;
      progressCallback(bytesCopied / fileSize);
    });
    readStream.on('end', () => {
      didFinish = true;
      onCompletion(didFinish, null, stat);
    });
    readStream.on('close', (error) => {
      if (!didFinish) {
        onCompletion(false, error);
      }
    });
    readStream.pipe(writeStream);
    return readStream;
  } catch (e) {
    setTimeout(() => {
      onCompletion(false, e, null);
    }, 0);
  }
}

module.exports = {
  files: {},        // key is the src, value is dst
  queue: [],        // a list of {src, dst, ext}
  inProgress: null, // {src, dst, progress, stream}

  // associatedExt is optional. It specifies an associated file's extension
  // that should be copied along with the main file. E.g., '.rylo'
  addFile(src, dst, associatedExt, isAssociatedFile) {
    this.files[src] = dst;
    const transfer = {
      src, dst, ext: associatedExt, isAssociatedFile,
    };
    if (isAssociatedFile) {
      this.queue.unshift(transfer);
    } else {
      this.queue.push(transfer);
    }
    this.processNext();
  },
  removeFile(src, dontProcessNext) {
    delete this.files[src];
    this.queue = this.queue.filter(a => a.src !== src);
    if (this.inProgress && this.inProgress.src === src) {
      this.cancelInProgress();
    }
    if (dontProcessNext) {
      return;
    }
    this.processNext();
  },
  removeAllFiles() {
    this.files = {};
    this.queue.length = 0;
    this.cancelInProgress();
  },

  progressForFile(src) {
    if (this.files[src]) {
      return this.inProgress.src === src ? this.inProgress.progress : 0;
    }
    return -1;
  },

  cancelInProgress() {
    if (this.inProgress) {
      this.inProgress.stream.close();
      this.inProgress = null;
    }
  },

  processNext() {
    if (!this.inProgress && this.queue.length > 0) {
      const transfer = this.queue[0];
      const tmp = path.parse(transfer.dst).dir + '/rylo.download~';
      this.inProgress = {
        src: transfer.src,
        dst: transfer.dst,
        ext: transfer.ext,
        progress: 0,
        stream: copyFile(transfer.src, tmp, (progress) => {
          if (this.inProgress) {
            this.inProgress.progress = progress;
          }
          m.redraw();
        }, (didFinish, error, stat) => {
          this.inProgress = null;
          this.removeFile(transfer.src, true);   // remove this file from the queue regardless of success/error

          if (didFinish && stat) {
            let { dst } = transfer;
            if (!transfer.isAssociatedFile) {
              const p = path.parse(dst);
              for (i=0; i < 20; i++) {
                if (!fs.existsSync(dst)) {
                  break;
                }
                dst = `${p.dir}/${p.name} (${i+1})${p.ext}`;
              }
            }
            let success = true;
            try {
              fs.renameSync(tmp, dst);
              fs.utimesSync(dst, stat.mtime, stat.mtime);
            } catch (e) {
              success = false;
            }
            if (success && transfer.ext) {
              this.addFile(replaceExtension(transfer.src, transfer.ext), replaceExtension(dst, transfer.ext), null, true);
            }
          } else {
            try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
          }

          ipcRenderer.emit('transfer-complete', {
            didFinish,
            sourceFile: transfer.src,
            fileInfo: stat,
          });

          this.processNext();
          m.redraw();
        }),
      };
    }
  },
};
