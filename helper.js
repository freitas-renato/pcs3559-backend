const util = require("util");
const Multer = require("multer");
const maxSize = 5 * 1024 * 1024;

let processFile = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: maxSize },
}).single("file");

// let processFile = Multer({
//     storage: Multer.memoryStorage(),
//     limits: { fileSize: maxSize },
//   }).fields([{ name: "file", maxCount: 3 }]);

let processFileMiddleware = util.promisify(processFile);

module.exports = processFileMiddleware;