import path from 'path'
import util from 'util'
const exec = util.promisify(require('child_process').exec)
//import archiver from 'archiver'

/**
 * Zips a given directory, then returns the path to the zipfile.
 *
 * NOTE: the 'archiver' library does not support the -X (--no-extra) flag,
 * which is needed to exclude metadata from being included in zip (which causes
 * md5sum to be different every time). So we have to defer to the command-line
 * instead.
 *
 * @param dirToZip The directory to zip.
 * @param outDir Where to save the zip file.
 * @return zipfile path.
 */
export async function zipDir(dirToZip, outDir) {

  const zipFile = path.join(
    outDir,
    dirToZip.split('/').join('-') + '.zip'
  )

  await exec(`zip -rX ${zipFile} ${dirToZip}`)
  return zipFile

  /*
  const output = fs.createWriteStream(zipFile)
  const archive = archiver('zip', { zlib: { level: 1 } })

  archive.directory(dirToZip, false);
  archive.pipe(output)
  archive.finalize()
  return zipFile
  */
}
