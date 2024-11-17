document.addEventListener('DOMContentLoaded', function() {
    const knobInner = document.getElementById('knob-inner');
    const knobPointer = document.getElementById('knob-pointer');
    const currentValueDisplay = document.getElementById('current-value');

    let currentAngle = 0;
    let mouseIsDown = false;
    let startY = 0;

    // Adjust clamp values for smaller circle
    function clamp(value, max, min) {
        return Math.max(min, Math.min(max, value));
    }

    function updateMode(angle) {
        let currentMode;

        if (angle > 30) { // Reduced angle threshold
            currentMode = 'Delete';
        } else if (angle < -30) { // Reduced angle threshold
            currentMode = 'Disable';
        } else {
            currentMode = 'Replace';
        }

        currentValueDisplay.textContent = currentMode;

        chrome.storage.local.set({
            enabled: currentMode !== 'Disable',
            mode: currentMode.toLowerCase()
        });

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'filter',
                mode: currentMode.toLowerCase(),
                enabled: currentMode !== 'Disable'
            });
        });
    }

    function rotateKnob(angle) {
        knobInner.style.transform = `rotate(${angle}deg)`;
        updateMode(angle);
    }

    knobInner.addEventListener("mousedown", (e) => {
        startY = e.pageY;
        mouseIsDown = true;
    });

    document.addEventListener("mouseup", () => {
        mouseIsDown = false;
    });

    knobInner.addEventListener("mousemove", (e) => {
        if (mouseIsDown) {
            const distance = clamp(startY - e.pageY, 60, -60); // Reduced movement range
            currentAngle = distance * 1.5; // Reduced rotation multiplier
            rotateKnob(currentAngle);
        }
    });

    chrome.storage.local.get(['mode'], function(result) {
        switch (result.mode) {
            case 'disable': currentAngle = -45; break; // Reduced angles
            case 'delete': currentAngle = 45; break;
            default: currentAngle = 0; break;
        }
        rotateKnob(currentAngle);
    });
});