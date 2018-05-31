import fs from 'fs'

/**
 * Performs async read of file.
 */
export function asyncReadFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

/**
 * Performs async write to file.
 */
export function asyncWriteFile(path, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, err => {
      if (err) return reject(err)
      resolve()
    })
  })
}
