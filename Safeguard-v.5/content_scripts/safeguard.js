(() => {
  /**
   * Check and set a global guard variable.
   * If this content script is injected into the same page again,
   * it will do nothing next time.
   */
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

async function moderateText(text) {
  try {
    const apiKey = "";
    const response = await fetch(`https://language.googleapis.com/v1/documents:moderateText?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        document: {
          type: "PLAIN_TEXT",
          content: text
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const categoriesToCheck = [
      "Toxic", "Insult", "Profanity", "Derogatory", "Death, Harm & Tragedy", 
      "Violent", "Public Safety", "War & Conflict"
    ];

    if (data.moderationCategories) {
      for (const category of data.moderationCategories) {
        if (categoriesToCheck.includes(category.name) && category.confidence > 0.5) {
          console.log(`Moderating text: ${text}`);
          console.log(`${category.name}: Confidence ${category.confidence} (Above threshold)`);
          return true;
        }
      }
    } else {
      console.warn("No moderation categories found in response");
    }
    return false;

  } catch (error) {
    console.error("Moderation failed:", error);
    return false;
  }
}

// Example call
// moderateText("ช่วยดูหน่อย 2เรื่องนี้ ฝึกมาดีหรือมีการวางยา? ก่อนนี้คิดว่าหมาแมวแสดงดี คนฝึกเก่งมาตลอด ตอนนี้ไม่ไว้ใจไปหมดแล้ววว ฝากช่อง ผู้จัด เจ้าของ อีก2เรื่องนี้ชี้แจงหน่อยค่ะ น้องหมา จากเรื่อง ละครชีวิต ภาค 2 แมวส้ม จากเรื่องบ้านแสงสูรย์ (เก่า) cr. thailandbubbyboy #แบนแม่หยัว")
//   .then(result => console.log("Moderation result:", result))
//   .catch(error => console.error("Error:", error));
 

  function hidePost() {
    const articles = document.querySelectorAll("article");
    articles.forEach((article, index) => {
        // article.style.border = "2px solid red";

        const tweetTextElements = article.querySelectorAll('div[data-testid="tweetText"] span');
        
        if (tweetTextElements.length > 0) {
            let tweetText = "";
            
            // Loop through each span and append its text content
            tweetTextElements.forEach(span => {
                tweetText += span.textContent.trim() + " "; // Concatenate with space
            });

            tweetText = tweetText.trim(); // Remove trailing space
            // if (tweetText.includes("a")) {
            //   article.style.border = "2px solid red";
            // }
            moderateText(tweetText).then(result => {
              if (result === true) {
                // article.style.border = "2px solid red";
                article.style.display = "none";
              }
            }).catch(error => {
              console.error("Error during moderation:", error);
            });

            console.log("Tweet text:", tweetText); // Output the combined tweet text
        }
    });
  }


  function showPost() {
    const articles = document.querySelectorAll("article");
    articles.forEach((article, index) => {
        article.style.display = "block"; // Hide the article
        // article.style.border = "none"
      
    });
  }
  

  const mutationObserver = new MutationObserver(entries => {
    hidePost()
    console.log(entries)
  })

  function waitForParent() {
    const timelineDiv = [...document.querySelectorAll('div')]
      .find(div => div.getAttribute('aria-label')?.includes("Timeline:"));

    const parent = timelineDiv ? timelineDiv.querySelector('div') : null;

    console.log(parent || "No inner div found.");

    // const parent = document.querySelector('div[aria-label="Timeline: Your Home Timeline"] > div');
    if (parent) {
      console.log("Parent found");
      console.log("Parent:", parent);
      mutationObserver.observe(parent, {
        childList: true,
        subtree: true,  // Observe all descendants, not just direct children
      });

    } else {
      console.log("Parent element not found, retrying...");
      setTimeout(waitForParent, 100);  // Retry every 100ms
    }
  }


  /**
   * Listen for messages from the background script.
   * Call "insertBeast()" or "removeExistingBeasts()".
   */
  browser.runtime.onMessage.addListener((message) => {
    if (message.command === "safe") {
      waitForParent();
    } else if (message.command === "reset") {
      mutationObserver.disconnect()
      showPost();
    }
  });
})();
