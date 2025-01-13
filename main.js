const { app, BrowserWindow, ipcMain  } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 500,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.setMenuBarVisibility(false);

    win.loadFile("index.html");
}

app.whenReady().then(() => {
    createWindow();
});

ipcMain.on("restart-app", () => {
    app.relaunch();
    app.exit();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
