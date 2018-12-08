import { google } from 'googleapis'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'

import { asyncReadFile, asyncWriteFile } from './file'

/**
 * Finds a directory with the given name on Drive.
 * @param name Directory name.
 * @param auth Authentication object.
 * @return { id, name }
 */
export async function findDir(name, auth) {
  const drive = google.drive({version: 'v3', auth})
  const mimeType = 'application/vnd.google-apps.folder'
  const response = await drive.files.list({
    q: `name = '${name}' and mimeType = '${mimeType}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1000
  })
  return response.data.files.find(f => (f.name === name))
}

/**
 * Deletes a file from Drive.
 * @param fileId ID of file to delete.
 * @param auth Authentication object.
 * @return Promise object.
 */
export async function deleteFile(fileId, auth) {
  const drive = google.drive({version: 'v3', auth})
  return drive.files.delete({ fileId })
}

/**
 * Creates a new file on Drive.
 * @param params The params passed directly to drive.files.create
 * @param auth Authentication object.
 * @return file data object.
 */
async function create(params, auth) {
  const drive = google.drive({version: 'v3', auth})
  const response = await drive.files.create(params)
  return response.data
}

/**
 * Lists files on Drive.
 * @param mimeType Only list files with this mime type.
 * @param folderId only list files in this folder.
 * @param auth Authentication object.
 * @return list of files.
 */
export async function listFiles(mimeType, folderId, auth) {
  const drive = google.drive({version: 'v3', auth})
  const response = await drive.files.list({
    q: (`mimeType = '${mimeType}'`
      + ' and trashed = false '
      + `and '${folderId}' in parents`),
    fields: `files(id, name, md5Checksum)`,
    pageSize: 1000
  })
  return response.data.files
}

/**
 * Creates a new directory on Drive.
 * @param name The name of the directory.
 * @param Authentication object.
 * @param useExisting If true and a directory with the given name already 
 * exists, then return it instead of creating a new one.
 * @return directory object.
 */
export async function createDir(name, auth, useExisting = false) {

  if (useExisting) {
    const existingDir = await findDir(name, auth)
    if (existingDir) {
      return existingDir
    }
  }

  var resource = { name, mimeType: 'application/vnd.google-apps.folder' }
  return await create({ resource, fields: 'id' }, auth)
}

/**
 * Uploads a file to Drive.
 * @param filePath Path to the local file to upload.
 * @param folderId A Drive folder to place the file in.
 * @param Authentication object.
 * @return A promise.
 */
export function uploadFile(filePath, folderId, auth) {

  const resource = {
    name: path.basename(filePath),
    parents: [folderId]
  }

  const media = {
    mimeType: mime.lookup(filePath),
    body: fs.createReadStream(filePath)
  }

  return create({ resource, media, fields: 'id' }, auth)
}

/**
 * Loads client secret and gets Drive authorization.
 * @param secretPath Path to OAUth client secret.
 * @param tokenPath Where to put/fetch authorization token
 * @return authentication object.
 */
export async function loadClientSecret(secretPath, tokenPath) {
  const content = await asyncReadFile(secretPath)
  return await authorize(JSON.parse(content), tokenPath)
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param credentials The authorization client credentials.
 * @param tokenPath Where to put/fetch authorization token
 */
async function authorize(credentials, tokenPath) {
  var clientSecret = credentials.installed.client_secret
  var clientId = credentials.installed.client_id
  var redirectUrl = credentials.installed.redirect_uris[0]
  var oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUrl)

  try {
    const token = await asyncReadFile(tokenPath)
    oauthClient.credentials = JSON.parse(token)
    return oauthClient
  } catch (e) {
    return await getNewToken(oauthClient, tokenPath)
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, tokenPath) {

  const scope = ['https://www.googleapis.com/auth/drive']

  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope
  })
  console.log('Authorize this app by visiting this url: ', authUrl)
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {

    rl.question('Enter the code from that page here: ', function(code) {
      rl.close()
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err)
          return
        }
        oauth2Client.credentials = token
        storeToken(token, tokenPath)
        resolve(oauth2Client)
      })
    })
  })
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token, tokenPath) {
  try {
    const tokenDir = path.dirname(tokenPath)
    fs.mkdirSync(tokenDir)
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err
    }
  }
  fs.writeFileSync(tokenPath, JSON.stringify(token))
  console.log('Token stored to ' + tokenPath)
}
