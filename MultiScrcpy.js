const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class MultiScrcpy {
    constructor() {
        this.devices = [];
        this.processMap = new Map();
    }

    async getScreenResolution() {
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execAsync('wmic path Win32_VideoController get CurrentVerticalResolution,CurrentHorizontalResolution');
                const [height, width] = stdout.trim().split('\n')[1].trim().split(/\s+/).map(Number);
                return { width, height };
            } else {
                const { stdout } = await execAsync('xrandr | grep "\\*"');
                const match = stdout.match(/(\d+)x(\d+)/);
                if (match) {
                    return {
                        width: parseInt(match[1]),
                        height: parseInt(match[2])
                    };
                }
            }
            return { width: 1920, height: 1080 }; // fallback
        } catch (error) {
            console.error('Error getting screen resolution:', error);
            return { width: 1920, height: 1080 }; // fallback
        }
    }

    async getConnectedDevices() {
        try {
            const { stdout } = await execAsync('adb devices');
            const lines = stdout.split('\n');
            this.devices = lines
                .slice(1)
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const [id] = line.split('\t');
                    return id.trim();
                });
            return this.devices;
        } catch (error) {
            console.error('Error getting devices:', error);
            return [];
        }
    }

    async getDeviceResolution(deviceId) {
        try {
            const { stdout } = await execAsync(`adb -s ${deviceId} shell wm size`);
            const match = stdout.match(/(\d+)x(\d+)/);
            if (match) {
                return {
                    width: parseInt(match[1]),
                    height: parseInt(match[2])
                };
            }
            return null;
        } catch (error) {
            console.error(`Error getting resolution for device ${deviceId}:`, error);
            return null;
        }
    }

    calculateWindowSize(deviceResolution, screenHeight, maxWidth = 300) {
        if (!deviceResolution) {
            return { width: maxWidth, height: maxWidth * 2 };
        }

        const aspectRatio = deviceResolution.height / deviceResolution.width;
        const width = Math.min(maxWidth, deviceResolution.width);
        
        // Calculate height and ensure it doesn't exceed screen height minus padding
        const maxHeight = screenHeight - 100; // Leave 50px padding top and bottom
        let height = Math.round(width * aspectRatio);
        
        // If height exceeds maximum, recalculate width to maintain aspect ratio
        if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height / aspectRatio);
        }

        // Calculate vertical center with adjusted height
        const y = 100;

        return { width, height, y };
    }

    async launchScrcpy(deviceId, options = {}) {
        const {
            x = 0,
            y = 0,
            width = 300,
            height = 600,
            bitrate = '16M',
            maxFps = 60,
            maxSize = 1084
        } = options;

        const args = [
            '-s', deviceId,
            '--window-x', x,
            '--window-y', y,
            '--window-width', width,
            '--window-height', height,
            '--bit-rate', bitrate,
            '--max-fps', maxFps,
            '--max-size', maxSize,
            '--force-adb-forward'
        ];

        try {
            const process = spawn('scrcpy', args);
            console.log(`scrcpy ${args.join(' ')}`);
            this.processMap.set(deviceId, process);

            process.stdout.on('data', (data) => {
                console.log(`[${deviceId}] ${data.toString().trim()}`);
            });

            process.stderr.on('data', (data) => {
                console.log(`[${deviceId}] ${data.toString().trim()}`);
            });

            process.on('error', (error) => {
                console.error(`[${deviceId}] Error:`, error);
            });

            process.on('close', (code) => {
                console.log(`[${deviceId}] Process exited with code ${code}`);
                this.processMap.delete(deviceId);
            });

            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 500);
            })

            return true;
        } catch (error) {
            console.error(`[${deviceId}] Failed to launch scrcpy:`, error);
            return false;
        }
    }

    async launchAll(baseOptions = {}) {
        await this.getConnectedDevices();
            
        if (this.devices.length === 0) {
            console.log('No devices connected');
            return false;
        }

        const screenRes = await this.getScreenResolution();
        
        const devicePromises = this.devices.map(async (deviceId) => {
            const resolution = await this.getDeviceResolution(deviceId);
            const windowSize = this.calculateWindowSize(resolution, screenRes.height);
            return { deviceId, ...windowSize };
        });

        const deviceConfigs = await Promise.all(devicePromises);

        console.log(deviceConfigs)
        
        // Calculate total width of all windows including spacing
        const totalWidth = deviceConfigs.reduce((sum, config) => sum + config.width, 0) + 
                          (deviceConfigs.length - 1) * 10;
        
        // Calculate starting X position to center all windows horizontally
        let currentX = 0;

        for (const config of deviceConfigs) {
            const options = {
                ...baseOptions,
                x: Math.round(currentX),
                y: config.y,
                width: config.width,
                height: config.height
            };

            await this.launchScrcpy(config.deviceId, options);
            currentX += config.width + 10;
        }

        return true;
    }

    stopAll() {
        for (const [deviceId, process] of this.processMap) {
            process.kill();
            console.log(`Stopped scrcpy for device ${deviceId}`);
        }
        this.processMap.clear();
    }
}

export default MultiScrcpy;