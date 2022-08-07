import bb from "busboy";
import os from "os";
import path from "path";
import fs from "fs";

export default (req, res, next) => {
  const busboy = bb({
    headers: req.headers,
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  const fields = {};
  const files = [];
  const fileWrites = [];
  const tmpdir = os.tmpdir();

  busboy.on("field", (key, value) => {
    fields[key] = value;
  });

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    const filepath = path.join(tmpdir, filename.filename);
    // console.log(
    //   `Handling file upload field ${fieldname}: ${filename.filename} (${filepath})`
    // );
    const writeStream = fs.createWriteStream(filepath);
    file.pipe(writeStream);

    fileWrites.push(
      new Promise((resolve, reject) => {
        file.on("end", () => writeStream.end());
        writeStream.on("finish", () => {
          fs.readFile(filepath, (err, buffer) => {
            const size = Buffer.byteLength(buffer);
            // console.log(`${filename.filename} is ${size} bytes`);
            if (err) {
              return reject(err);
            }

            files.push({
              fieldname,
              originalname: filename,
              encoding,
              mimetype,
              buffer,
              size,
            });

            try {
              fs.unlinkSync(filepath);
            } catch (error) {
              return reject(error);
            }

            resolve();
          });
        });
        writeStream.on("error", reject);
      })
    );
  });

  busboy.on("finish", () => {
    Promise.all(fileWrites)
      .then(() => {
        req.body = fields;
        req.files = files;
        next();
      })
      .catch(next);
  });

  busboy.end(req.rawBody);
};