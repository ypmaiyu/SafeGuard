let isEnabled = true;
let currentMode = 'blur';
let profaneWords = [];

// Load words once and cache them
fetch(chrome.runtime.getURL('data/profane-words.txt'))
    .then(response => response.text())
    .then(text => {
        profaneWords = text.split('\n').filter(word => word.trim().length > 0);
    });

// Get current mode immediately
chrome.storage.local.get(['mode', 'enabled'], function(result) {
    currentMode = result.mode || 'blur';
    isEnabled = result.enabled;
    if (isEnabled) {
        scanDocument();
    }
});
function addHoverEffects() {
    const style = document.createElement('style');
    style.textContent = `
        .safeguard-blur {
            cursor: pointer;
            transition: filter 0.3s ease-in-out !important;
        }
        .safeguard-blur:hover {
            filter: blur(2px) !important;
        }
    `;
    document.head.appendChild(style);
}
function addFilteredBadge(element) {
    const badge = document.createElement('span');
    badge.className = 'safeguard-badge';
    badge.innerHTML = '🛡️';
    badge.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        background: #ff4444;
        color: white;
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 12px;
        z-index: 1000;
    `;
    element.style.position = 'relative';
    element.appendChild(badge);
}
function createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'safeguard-status';
    indicator.innerHTML = `
        <div class="status-icon ${isEnabled ? 'active' : 'inactive'}">
            ${isEnabled ? '🛡️' : '⚠️'}
        </div>
        <div class="status-text">
            ${currentMode.toUpperCase()} Mode
        </div>
    `;
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.9);
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        opacity: 0.8;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(indicator);
}
function showProcessingIndicator(element) {
    element.classList.add('safeguard-processing');
    const spinner = document.createElement('div');
    spinner.className = 'safeguard-spinner';
    spinner.style.cssText = `
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    `;
    element.appendChild(spinner);
}

function updateFilterStyle(mode) {
    const style = document.createElement('style');
    style.textContent = `
        .filtered-content {
            transition: all 0.3s ease-in-out;
        }
        .filtered-content.blur-mode {
            filter: blur(5px);
        }
        .filtered-content.replace-mode {
            background: #f0f8ff;
            padding: 2px 5px;
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);
}

function filterText(node) {
    if (!isEnabled || !node || !profaneWords.length) return;
    
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        let text = node.textContent;
        let wasFiltered = false;
        
        if (currentMode === 'delete') {
            profaneWords.forEach(word => {
                const regex = new RegExp(`\\s*\\b${word}\\b\\s*`, 'gi');
                if (regex.test(text)) {
                    // Remove the word and any surrounding spaces
                    text = text.replace(regex, '');
                    wasFiltered = true;
                }
            });
        } else if (currentMode === 'replace') {
            // Existing replace mode logic
            profaneWords.forEach(async word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                if (regex.test(text)) {
                    const betterWord = await getVertexAIReplacement(word);
                    text = text.replace(regex, betterWord);
                    wasFiltered = true;
                }
            });
        }

        if (wasFiltered) {
            node.textContent = text;
        }
    }
}
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'filter') {
        isEnabled = message.enabled;
        currentMode = message.mode;
        
        // Clear all filters when disabling
        if (!isEnabled || currentMode === 'disable') {
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.transition = 'all 0.3s ease';
                el.style.filter = 'none';
                el.classList.remove('filtered-content', 'blur-mode', 'replace-mode');
            });
            
            // Reset text content if it was modified
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.originalContent) {
                    node.textContent = node.originalContent;
                }
            }
        } else {
            // Re-enable filtering with new mode
            scanDocument();
        }
    }
    return true;
});// Optimize mutation observer
const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    
    requestAnimationFrame(() => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    scanNode(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    filterText(node);
                }
            });
        });
    });
});

function scanNode(node) {
    const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    while (walker.nextNode()) {
        filterText(walker.currentNode);
    }
}

function scanDocument() {
    scanNode(document.body);
}

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'filter') {
        isEnabled = message.enabled;
        currentMode = message.mode;
        
        // Clear existing filters smoothly
        document.querySelectorAll('.filtered-content').forEach(el => {
            el.style.transition = 'all 0.3s ease';
            el.style.filter = 'none';
        });
        
        // Wait for transition to complete then reapply new mode
        setTimeout(() => {
            if (isEnabled) {
                // Re-scan with new mode settings
                scanDocument();
                
                // Apply new effects based on mode
                if (currentMode === 'blur') {
                    document.querySelectorAll('.filtered-content').forEach(el => {
                        el.style.filter = 'blur(5px)';
                        el.style.transition = 'filter 0.3s ease';
                    });
                }
            }
        }, 300);
    }
    return true; // Keep message channel open
});

function filterImages() {
    if (!isEnabled) return;
    
    // Select all images and stickers
    const images = document.querySelectorAll('img, .sticker, .emoji');
    
    images.forEach(img => {
        // Check image alt text and surrounding text for profanity
        const altText = img.alt?.toLowerCase() || '';
        const nearbyText = img.parentElement?.textContent?.toLowerCase() || '';
        
        let shouldBlur = false;
        profaneWords.forEach(word => {
            if (altText.includes(word) || nearbyText.includes(word)) {
                shouldBlur = true;
            }
        });
        
        if (shouldBlur) {
            img.style.filter = 'blur(15px)';
            img.style.transition = 'filter 0.3s';
        }
    });
}
const replacementCache = new Map();
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedScanDocument = debounce(scanDocument, 250);

async function batchProcessWords(words) {
    const uncachedWords = words.filter(word => !replacementCache.has(word));
    if (uncachedWords.length === 0) return;

    try {
        const response = await fetch('https://us-central1-x-entropy-438407-j4.cloudfunctions.net/replaceInappropriate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texts: uncachedWords,
                task: 'batch_replace'
            })
        });
        
        const replacements = await response.json();
        
        // Update cache with batch results
        replacements.forEach((replacement, index) => {
            replacementCache.set(uncachedWords[index], replacement);
        });
    } catch (error) {
        console.error('Error in batch processing:', error);
    }
}

async function getVertexAIReplacement(badWord) {
    // Check cache first
    if (replacementCache.has(badWord)) {
        return replacementCache.get(badWord);
    }

    try {
        const response = await fetch('https://us-central1-x-entropy-438407-j4.cloudfunctions.net/replaceInappropriate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: badWord,
                task: 'replace_inappropriate'
            })
        });
        
        const data = await response.json();
        const replacement = data.replacement || badWord;
        
        // Cache the result
        replacementCache.set(badWord, replacement);
        return replacement;
    } catch (error) {
        console.error('Error getting replacement:', error);
        return badWord;
    }
}// Initial scan
async function getVertexAIReplacementWithRetry(badWord, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await getVertexAIReplacement(badWord);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
}
const metrics = {
    processedWords: 0,
    apiCalls: 0,
    cacheHits: 0,
    errors: 0
};

function logMetrics() {
    console.log('Performance Metrics:', metrics);
}

// Log metrics every 5 minutes
setInterval(logMetrics, 300000);

scanDocument();
filterImages();
observer.observe(document.body, {
    childList: true,
    subtree: true
});
