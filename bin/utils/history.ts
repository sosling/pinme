import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import dayjs from 'dayjs';
import chalk from 'chalk';
import { formatSize } from './uploadLimits';

// history file path
const HISTORY_DIR = path.join(os.homedir(), '.pinme');
const HISTORY_FILE = path.join(HISTORY_DIR, 'upload-history.json');

interface UploadRecord {
  timestamp: number;
  date: string;
  path: string;
  filename: string;
  contentHash: string;
  previewHash: string | null;
  size: number;
  fileCount: number;
  type: 'directory' | 'file';
}

interface UploadHistory {
  uploads: UploadRecord[];
}

interface UploadData {
  path: string;
  filename?: string;
  contentHash: string;
  previewHash: string | null;
  size: number;
  fileCount?: number;
  isDirectory?: boolean;
}

// ensure the history directory exists
const ensureHistoryDir = (): void => {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeJsonSync(HISTORY_FILE, { uploads: [] });
  }
};

// save the upload history
const saveUploadHistory = (uploadData: UploadData): boolean => {
  try {
    ensureHistoryDir();
    
    const history = fs.readJsonSync(HISTORY_FILE) as UploadHistory;
    
    // add new upload record
    const newRecord: UploadRecord = {
      timestamp: Date.now(),
      date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      path: uploadData.path,
      filename: uploadData.filename || path.basename(uploadData.path),
      contentHash: uploadData.contentHash,
      previewHash: uploadData.previewHash,
      size: uploadData.size,
      fileCount: uploadData.fileCount || 1,
      type: uploadData.isDirectory ? 'directory' : 'file'
    };
    
    history.uploads.unshift(newRecord); // add to the beginning
    
    // write to file
    fs.writeJsonSync(HISTORY_FILE, history, { spaces: 2 });
    return true;
  } catch (error: any) {
    console.error(chalk.red(`Error saving upload history: ${error.message}`));
    return false;
  }
};

// get the upload history
const getUploadHistory = (limit: number = 10): UploadRecord[] => {
  try {
    ensureHistoryDir();
    
    const history = fs.readJsonSync(HISTORY_FILE) as UploadHistory;
    return history.uploads.slice(0, limit);
  } catch (error: any) {
    console.error(chalk.red(`Error reading upload history: ${error.message}`));
    return [];
  }
};

// display the upload history
const displayUploadHistory = (limit: number = 10): void => {
  const history = getUploadHistory(limit);
  
  if (history.length === 0) {
    console.log(chalk.yellow('No upload history found.'));
    return;
  }
  
  console.log(chalk.bold('\n📜 Upload History:'));
  console.log(chalk.dim('─'.repeat(80)));
  
  history.forEach((record, index) => {
    console.log(chalk.bold(`#${index + 1} - ${record.date}`));
    console.log(chalk.cyan(`Name: ${record.filename}`));
    console.log(chalk.cyan(`Path: ${record.path}`));
    console.log(chalk.cyan(`Type: ${record.type}`));
    console.log(chalk.cyan(`Size: ${formatSize(record.size)}`));
    if (record.type === 'directory') {
      console.log(chalk.cyan(`Files: ${record.fileCount}`));
    }
    console.log(chalk.cyan(`Content Hash: ${record.contentHash}`));
    if (record.previewHash) {
      console.log(chalk.cyan(`Preview Hash: ${record.previewHash}`));
      console.log(chalk.cyan(`URL: https://ipfs.glitterprotocol.dev/ipfs/${record.previewHash}/#/?from=local`));
    } else {
      console.log(chalk.cyan(`URL: https://ipfs.glitterprotocol.dev/ipfs/${record.contentHash}`));
    }
    console.log(chalk.dim('─'.repeat(80)));
  });
  
  // display the statistics
  const totalSize = history.reduce((sum, record) => sum + record.size, 0);
  const totalFiles = history.reduce((sum, record) => sum + record.fileCount, 0);
  console.log(chalk.bold(`Total Uploads: ${history.length}`));
  console.log(chalk.bold(`Total Files: ${totalFiles}`));
  console.log(chalk.bold(`Total Size: ${formatSize(totalSize)}`));
};

// clear the upload history
const clearUploadHistory = (): boolean => {
  try {
    ensureHistoryDir();
    fs.writeJsonSync(HISTORY_FILE, { uploads: [] });
    console.log(chalk.green('Upload history cleared successfully.'));
    return true;
  } catch (error: any) {
    console.error(chalk.red(`Error clearing upload history: ${error.message}`));
    return false;
  }
};

export {
  saveUploadHistory,
  getUploadHistory,
  displayUploadHistory,
  clearUploadHistory
}; 