chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'moderateText') {
    const text = message.text;
    try {
      const response = await fetch("https://language.googleapis.com/v1/documents:moderateText", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ABCD`,  // Replace with a valid token
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          document: {
            type: "PLAIN_TEXT",
            content: text,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
});
