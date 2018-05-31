import fs from 'fs'
import path from 'path'
import readline from 'readline'
import argparse from 'argparse'
import find from 'find'
import moment from 'moment'
import tmp from 'tmp'
import os from 'os'
import md5 from 'md5-file'

import * as drive from './drive'
import { zipDir } from './zip'

async function asyncForEach(array, callback) {
  for (let i = 0; i < array.length; ++i) {
    await callback(array[i])
  }
}

/**
 * Returns true if given dir is hidden.
 */
function isHiddenDir(dir) {
  return (dir.split('/').pop().charAt(0) === '.')
}

/**
 * Extracts & returns date from a zm event path
 * (eg zm_events/1/19/03/04/21/22/03).
 */
function extractDate(str) {
  return moment(str.split('/').slice(-6, -1).join(' '), 'YY MM DD HH mm')
}

/**
 * Returns array of paths, pointing to zm event directories that are within
 * a given date range.
 *
 * @param eventsDir Directory containing all zm events.
 * @param fromDate Start of date range. If null, there is no start date limit.
 * @param toDate End of date range. If null, there is no end date limit.
 * @return array of paths.
 */
async function findZmDirsWithinDate({ eventsDir,
  fromDate = null, toDate = null }) {

  // return true if given date is within fromDate and toDate
  const isWithinFromToDates = date => 
    ((fromDate === null || date.isAfter(fromDate))
      && (toDate === null || date.isBefore(toDate)));

  const files = await find.fileSync(/\.jpg$/, eventsDir)

  const dirs = files
    .map(f => path.dirname(f)) // just get dir names
    .filter(d => !isHiddenDir(d)) // filter out hidden dirs

  const uniqueDirs = [ ...new Set(dirs) ]

  return uniqueDirs.filter(d => isWithinFromToDates(extractDate(d)))
}

async function main() {

  const parser = new argparse.ArgumentParser({ addHelp: true })

  parser.addArgument('--eventsDir', {
    required: true,
    help: 'Directory where ZM events are stored.',
    metavar: 'DIR',
  })
  parser.addArgument('--clientSecret', {
    required: true,
    help: 'OAuth 2.0 client secret, for Google API authorization.',
    metavar: 'JSON_FILE',
  })
  parser.addArgument('--tokenDir', {
    defaultValue: path.join(os.homedir(), '.config', 'zm2drive'),
    help: ('Where to store OAuth 2.0 token, for subsequent zm2drive calls '
      + '(default: ~/.config/zm2drive).'),
    metavar: 'DIR',
  })
  parser.addArgument('--fromDate', {
    help: 'Upload only zm events after this date. ISO 8601.',
    metavar: 'DATE',
  })
  parser.addArgument('--toDate', {
    help: 'Upload only zm events before this date. ISO 8601.',
    metavar: 'DATE',
  })
  parser.addArgument('--targetDir', {
    help: 'Google Drive directory to upload files to',
    defaultValue: 'zm-events',
    metavar: 'REMOTE_DIR',
  })

  const args = parser.parseArgs()
  // where to store token, so we don't get asked again next time
  const tokenPath = path.join(args.tokenDir, 'credentials.json')
  // create tmp directory
  const tmpDir = await tmp.dirSync({ unsafeCleanup: true })

  try {

    const dirsToUpload = await findZmDirsWithinDate(args)

    if (dirsToUpload.length == 0) {
      console.log('No directories to upload.')
      return
    }

    const zipFiles = await Promise.all(
      dirsToUpload.map(d => zipDir(d, tmpDir.name))
    )

    console.log('Authenticating.')
    const auth = await drive.loadClientSecret(args.clientSecret, tokenPath)
    console.log('Preparing.')
    const dir = await drive.createDir(args.targetDir, auth, true)

    // fetch md5sums of already uploaded zip files
    const existingFileChecksums = 
      (await drive.listFiles('application/zip', dir.id, auth))
      .map(f => f.md5Checksum)

    // filter only zip files that have not already been uploaded
    const zipFilesToUpload = zipFiles.filter(zipFile => 
      !(existingFileChecksums.includes(md5.sync(zipFile)))
    )

    const numUploaded = zipFilesToUpload.length
    const numSkipped = zipFiles.length - zipFilesToUpload.length

    console.log(`Uploading ${numUploaded} files, skipping ${numSkipped}.`)

    // upload
    await asyncForEach(zipFilesToUpload, f => drive.uploadFile(f, dir.id, auth))
  } catch (e) {
    console.error(e)
  }

  tmpDir.removeCallback()
  console.log('Done!')
}

main()
