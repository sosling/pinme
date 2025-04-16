import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';
import ora from 'ora';
import chalk from 'chalk';
import { 
  checkFileSizeLimit, 
  checkDirectorySizeLimit, 
  formatSize, 
} from './uploadLimits';
import { saveUploadHistory } from './history';
import { getDeviceId } from './getDeviceId';

const ipfsApiUrl = process.env.IPFS_API_URL || 'https://ipfs.glitterprotocol.dev/api/v2';

interface FileInfo {
  name: string;
  path: string;
}


interface IpfsResponse {
  data: {
    data: Array<{
      Name: string;
      Hash: string;
      Size: string;
    }>;
  };
}

// dist is the directory name, dirPath is all paths before dist
let dirPath: string | null = null;

function loadFilesToArrRecursively(directoryPath: string, dist: string): FileInfo[] {
  const filesArr: FileInfo[] = [];
  const sep = path.sep;

  dirPath ??= directoryPath.replace(dist, '');

  // check if it is a directory
  if (fs.statSync(directoryPath).isDirectory()) {
    const files = fs.readdirSync(directoryPath);
    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      if (fs.statSync(filePath).isFile()) {
        // check the file size
        const sizeCheck = checkFileSizeLimit(filePath);
        if (sizeCheck.exceeds) {
          throw new Error(`File ${file} exceeds size limit of ${formatSize(sizeCheck.limit)} (size: ${formatSize(sizeCheck.size)})`);
        }

        const filePathWithNoEndSep = filePath.replace(dirPath!, '');
        const filePathEncodeSep = filePathWithNoEndSep.replaceAll(sep, '%2F');
        
        filesArr.push({
          name: filePathEncodeSep,
          path: filePath,
        });
      } else if (fs.statSync(filePath).isDirectory()) {
        const recursiveFiles = loadFilesToArrRecursively(filePath, dist);
        filesArr.push(...recursiveFiles);
      }
    });
  } else {
    console.error('Error: path must be a directory');
  }
  return filesArr;
}

function countFilesInDirectory(directoryPath: string): number {
  let count = 0;
  const files = fs.readdirSync(directoryPath);
  
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      count++;
    } else if (stats.isDirectory()) {
      count += countFilesInDirectory(filePath);
    }
  }
  
  return count;
}

// upload directory to ipfs
async function uploadDirectory(directoryPath: string, deviceId: string): Promise<string | null> {
  // check the size of all files in the directory
  const sizeCheck = checkDirectorySizeLimit(directoryPath);
  
  // check the size limit of single file
  if (sizeCheck.exceeds) {
    throw new Error(`Directory ${directoryPath} exceeds size limit of ${formatSize(sizeCheck.limit)} (size: ${formatSize(sizeCheck.size)})`);
  }

  const formData = new FormData();

  // redundant check for directoryPath, ensure directoryPath ends with no separator
  if (directoryPath.endsWith(path.sep)) directoryPath = directoryPath.slice(0, -1);

  // get the last layer directory, as the ipfs directory name
  const dist = directoryPath.split(path.sep).pop() || '';

  // recursively get all files
  const files = loadFilesToArrRecursively(directoryPath, dist);
  files.forEach((file) => {
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.name,
    });
  });
  formData.append('uid', deviceId);

  const spinner = ora(`Uploading ${directoryPath} to glitter ipfs...`).start();
  const response = await axios.post<IpfsResponse['data']>(`${ipfsApiUrl}/add`, formData, {
    headers: {
      ...formData.getHeaders(),
    },
  });

  const resData = response.data.data;
  // check if the returned data is an array and contains at least one element
  if (Array.isArray(resData) && resData.length > 0) {
    spinner.succeed();
    // find the object with Name as an empty string, get the directory hash
    const directoryItem = resData.find((item) => item.Name === dist);
    if (directoryItem) {
      const fileStats = fs.statSync(directoryPath);
      const fileCount = countFilesInDirectory(directoryPath);
      const uploadData = {
        path: directoryPath,
        filename: path.basename(directoryPath),
        contentHash: directoryItem.Hash,
        previewHash: null,
        size: sizeCheck.size,
        fileCount: fileCount,
        isDirectory: true
      };
      saveUploadHistory(uploadData);
      return directoryItem.Hash;
    }
    spinner.fail();
    console.log(chalk.red(`Directory hash not found in response`));
  } else {
    spinner.fail();
    console.log(chalk.red(`Invalid response format from IPFS`));
  }
  return null;
}

// upload file to ipfs
async function uploadFile(filePath: string, deviceId: string): Promise<string | null> {
  const sizeCheck = checkFileSizeLimit(filePath);
  if (sizeCheck.exceeds) {
    throw new Error(`File ${filePath} exceeds size limit of ${formatSize(sizeCheck.limit)} (size: ${formatSize(sizeCheck.size)})`);
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath), {
    filename: filePath.split(path.sep).pop() || '',
  });
  formData.append('uid', deviceId);

  const spinner = ora(`Uploading ${filePath} to glitter ipfs...`).start();
  const response = await axios.post<IpfsResponse['data']>(`${ipfsApiUrl}/add`, formData, {
    headers: {
      ...formData.getHeaders(),
    },
  });

  const resData = response.data.data;
  // check if the returned data is an array and contains at least one element
  if (Array.isArray(resData) && resData.length > 0) {
    spinner.succeed();
    // find the object with Name as an empty string, get the file hash
    const fileItem = resData.find((item) => item.Name === filePath.split(path.sep).pop() || '');
    if (fileItem) {
      const uploadData = {
        path: filePath,
        filename: filePath.split(path.sep).pop() || '',
        contentHash: fileItem.Hash,
        previewHash: null,
        size: sizeCheck.size,
        fileCount: 1,
        isDirectory: false
      };
      saveUploadHistory(uploadData);
      return fileItem.Hash;
    }
    spinner.fail();
    console.log(chalk.red(`File hash not found in response`));
  } else {
    spinner.fail();
    console.log(chalk.red(`Invalid response format from IPFS`));
  }
  return null;
}

export default async function(filePath: string): Promise<{contentHash: string, previewHash?: string | null}> {
  // check if the file is a directory
  const deviceId = getDeviceId();
  if (!deviceId) {
    throw new Error('Device ID not found');
  }
  if (fs.statSync(filePath).isDirectory()) {
    return {
      contentHash: await uploadDirectory(filePath, deviceId) || '',
      previewHash: null
    };
  } else {
    return {
      contentHash: await uploadFile(filePath, deviceId) || '',
      previewHash: null
    };
  }
} 