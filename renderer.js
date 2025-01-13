const { exec, spawn } = require("child_process");
let multiScrcpy = null;
const deviceList = document.getElementById("deviceList");
const toggleButton = document.getElementById("toggleButton");
import MultiScrcpy from "./MultiScrcpy.js";
const { ipcRenderer } = require("electron");

const $ = (name) => document.querySelector(name);
const $$ = (name) => document.querySelectorAll(name);

function updateDeviceList() {
    // First get the list of connected devices
    exec("adb devices", (error, stdout, stderr) => {
        if (error) {
            deviceList.textContent = "Error getting devices: " + error;
            return;
        }

        // Get device IDs
        const deviceIds = stdout
            .split("\n")
            .slice(1) // Skip first line (header)
            .filter((line) => line.trim().length > 0)
            .map((line) => line.split("\t")[0]);

        $("#deviceCount").textContent = `ADB Devices (${deviceIds.length})`;

        if (deviceIds.length === 0) {
            $("#toggleButton").setAttribute("disabled", true);
            deviceList.textContent = "No devices connected";
            return;
        }

        $("#toggleButton").removeAttribute("disabled");

        // For each device ID, get its model name
        Promise.all(
            deviceIds.map((deviceId) => {
                return new Promise((resolve) => {
                    exec(`adb -s ${deviceId} shell getprop ro.product.model`, (error, stdout, stderr) => {
                        const deviceName = error ? "Unknown Device" : stdout.trim();
                        resolve({
                            id: deviceId,
                            name: deviceName,
                        });
                    });
                });
            })
        ).then((devices) => {
            deviceList.innerHTML = devices
                .map(
                    (device) => `
                    <li class="py-1">
                        <span>${device.name}</span>
                        -
                        <span>${device.id}</span>
                    </li>
                `
                )
                .join("");
        });
    });
}

toggleButton.addEventListener("click", async () => {
    if (multiScrcpy === null) {
        toggleButton.setAttribute("disabled", true);
        // Start scrcpy
        async function main() {
            multiScrcpy = new MultiScrcpy();

            await multiScrcpy.launchAll({
                bitrate: "16M",
                maxFps: 60,
                maxSize: 1084,
            });
        }

        await main().catch(console.error);

        // scrcpyProcess.on("error", (err) => {
        //     console.error("Failed to start scrcpy:", err);
        //     scrcpyProcess = null;
        //     toggleButton.textContent = "Start Scrcpy";
        //     toggleButton.classList.remove("active");
        // });

        toggleButton.textContent = "Restart Tool";
        toggleButton.classList.add("active");
        toggleButton.removeAttribute("disabled");
    } else {
        multiScrcpy.stopAll();
        ipcRenderer.send("restart-app");
    }
});

console.log("run");

updateDeviceList();
setInterval(updateDeviceList, 2000);
