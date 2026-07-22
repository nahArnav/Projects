chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveNote") {
        chrome.storage.local.get(["savedNotes"], (data) => {
            let arrayNotes = data.savedNotes || [];

            // Build the organized object
            let newNote = {
                text: request.text,
                source: request.url
            };

            arrayNotes.unshift(newNote);

            chrome.storage.local.set({ savedNotes: arrayNotes }, () => {
                console.log("Note Saved Successfully✅");
            });
        });
    }
});
