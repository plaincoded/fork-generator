import fs from 'fs'
import path from 'path'

// Config
const directoryPath = './dist/uniswap2_liquidity/mainnet'
const suffix = '.liquidity_pool.uniswap2_liquidity'

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err)
    return
  }

  files.forEach((file) => {
    const oldPath = path.join(directoryPath, file)

    // Get the base name and the extension
    const { name, ext } = path.parse(file)

    // Build the new name, removing the suffix
    const newName = name.endsWith(suffix)
      ? name.slice(0, -suffix.length) + ext
      : name + ext
    const newPath = path.join(directoryPath, newName)

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error('Error renaming the file:', err)
      } else {
        console.log(`Renaming: ${file} -> ${newName}`)
      }
    })
  })
})
