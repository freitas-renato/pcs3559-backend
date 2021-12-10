// Express js api server
const express = require('express');
const router = express.Router();
const { format } = require("util");
const { Storage } = require("@google-cloud/storage");
const path = require('path');
const multer = require('multer');

const processFile  = require('./helper.js');
const { send } = require('process');
const { response } = require('express');

const app = express();

// axios object
const axios = require('axios');

// Parse base64 env variable contating credentials
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString()
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key
  },
});

const bucket = storage.bucket("3d-print-viewer");


// Root route
app.get('/', (req, res) => {
    res.send({ 'message': 'Hello World!' });
});

// get object based on name
// Return a file on the server
app.get('/object/:name', (req, res) => {
    // Axios get method
    // console.log(req.params.name);
    // axios.get(`https://storage.googleapis.com/3d-print-viewer/${req.params.name}`).then(response => {
    //     // Prevent CORS block on response
    //     res.setHeader('Access-Control-Allow-Origin', '*');    
    //     res.send(response.data);
    // }).catch(error => {
    //     console.log(error);
    // });
    console.log(`Request: ${req.params.name}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    var resposta = {
        'name': req.params.name,
        'src': `https://storage.googleapis.com/3d-print-viewer/${req.params.name}`
    }
    res.send(resposta);
    // res.send({ "src": `https://storage.googleapis.com/3d-print-viewer/${req.params.name}` });
});




const upload = async (req, res) => {
  try {
    await processFile(req, res);

    console.log(req.file);

    if (!req.file) {
      return res.status(400).send({ message: "Please upload a file!" });
    }

    // Create a new blob in the bucket and upload the file data.
    const blob = bucket.file(req.file.originalname);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("error", (err) => {
      res.status(500).send({ message: err.message });
    });

    blobStream.on("finish", async (data) => {
      // Create URL for directly file access via HTTP.
      const publicUrl = format(
        `https://storage.googleapis.com/${bucket.name}/${blob.name}`
      );

      try {
        // Make the file public
        await bucket.file(req.file.originalname).makePublic();
      } catch {
        return res.status(500).send({
          message:
            `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
          url: publicUrl,
        });
      }

      res.status(200).send({
        message: "Uploaded the file successfully: " + req.file.originalname,
        url: publicUrl,
      });
    });

    blobStream.end(req.file.buffer);
  } catch (err) {
    res.status(500).send({
      message: `Could not upload the file: ${req.file.originalname}. ${err}`,
    });
  }
};


// Test uploading to google filestore

app.post('/upload', (req, res) => {
    upload(req, res);
});






// Accept multiple files using multer
const object = multer({ storage: multer.memoryStorage() })
// const cpUpload = upload2.fields([{ name: 'file_src', maxCount: 2 }, { name: 'file_bin', maxCount: 2 }]);
const cpUpload = object.fields([{ name: 'file', maxCount: 2 }]);
function sendUploadsToGCS (req, res, next) {
    if (!req.files) {
      return next()
    }

    var respose = { };
  
    let promises = []
    let vals = Object.values(req.files)
    console.log(vals);

    const fileTypes = ['gltf', 'glb'];
  
    for(let f of vals[0]) {
        console.log(f);
        const gcsname = f.originalname
        const file = bucket.file(gcsname)
    
        const stream = file.createWriteStream({
            metadata: {
            contentType: f.mimetype
            },
            resumable: false
        })
    
        stream.on('error', (err) => {
            f.cloudStorageError = err
            next(err)
        })
    
        stream.end(f.buffer)
    
        promises.push(
            new Promise ((resolve, reject) => {
                stream.on('finish', () => {
                    f.cloudStorageObject = gcsname;
                    const publicUrl = format(
                        `https://storage.googleapis.com/${bucket.name}/${file.name}`
                    );
                    console.log(`Uploaded file url: ${publicUrl}`);
                    console.log(`${f.originalname}`);
                    var field = f.originalname.split('.')[1];
                    response[field] = publicUrl;
                    if (fileTypes.includes(field)) {
                      response['name'] = f.originalname;
                    }
                    resolve()
                })
            })
        )
    }
    Promise.all(promises).then(() => next()).then(() => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(response)
    });
}

app.post('/object', cpUpload, (req, res, next) => {
    sendUploadsToGCS(req, res, next);
});



// PORT env variable is the port to listen on
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}!`);
});
