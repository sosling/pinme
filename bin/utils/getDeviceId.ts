import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export function getDeviceId(): string {
  const configDir = path.join(os.homedir(), '.pinme');
  const configFile = path.join(configDir, 'device-id');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  if (fs.existsSync(configFile)) {
    return fs.readFileSync(configFile, 'utf8').trim();
  }
  
  const deviceId = uuidv4();
  fs.writeFileSync(configFile, deviceId);
  return deviceId;
} 