chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: true });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_STATE') {
        chrome.storage.local.get(['enabled'], function(result) {
            sendResponse({ enabled: result.enabled });
        });
        return true;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['enabled'], function(result) {
            chrome.tabs.sendMessage(tabId, { 
                action: 'filter',
                enabled: result.enabled 
            });
        });
    }
});

