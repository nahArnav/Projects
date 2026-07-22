console.log("NoteWeb active");

window.notewebMarkerData = [];

// 0. UNIVERSAL URL CLEANER
function cleanUrl(url) {
    if (!url) return "";
    if (url.includes("youtube.com/watch")) url = url.split('&')[0];
    return url.split('#')[0];
}

// 1. HIGHLIGHT ENGINE
document.addEventListener("mouseup", () => {
    chrome.storage.local.get(["isHighlightEnabled"], (data) => {
        if (data.isHighlightEnabled) {
            let selection = window.getSelection();
            let selectedText = selection.toString().trim();

            if (selectedText.length > 0) {
                let newNote = {
                    id: Date.now().toString(),
                    text: selectedText,
                    source: cleanUrl(window.location.href),
                    type: "web"
                };

                chrome.storage.local.get(["savedNotes"], (storageData) => {
                    let notes = storageData.savedNotes || [];
                    // BUG FIX: Unshift pushes the newest note to the absolute top of the database
                    notes.unshift(newNote);
                    chrome.storage.local.set({ savedNotes: notes });
                });

                document.designMode = "on";
                document.execCommand("BackColor", false, "#ffff00");
                document.designMode = "off";
                selection.removeAllRanges();
            }
        }
    });
});

// 2. REHYDRATION ENGINE (3-Tier Fallback Highlighter)
function restoreHighlightsForPage() {
    chrome.storage.local.get(["savedNotes"], (data) => {
        let notes = data.savedNotes || [];
        let currentUrl = cleanUrl(window.location.href);

        let pageNotes = notes.filter(note => cleanUrl(note.source) === currentUrl);
        if (pageNotes.length === 0) return;

        let scrollX = window.scrollX;
        let scrollY = window.scrollY;

        // Reusable painting tool
        function applyHighlight(textStr) {
            window.getSelection().removeAllRanges();
            if (window.find(textStr, false, false, true)) {
                document.designMode = "on";
                document.execCommand("BackColor", false, "#ffff00");
                document.designMode = "off";
                return true;
            }
            return false;
        }

        pageNotes.forEach(noteObj => {
            if (noteObj.type === "sticky") {
                createStickyNoteUI(noteObj.id, noteObj.text, noteObj.x, noteObj.y);
                return;
            }

            let textToHighlight = noteObj.text;

            // Tier 1: Try the whole block
            if (!applyHighlight(textToHighlight)) {

                // Tier 2: Try chunking by paragraphs (bypasses big HTML gaps)
                let paragraphs = textToHighlight.split('\n').map(p => p.trim()).filter(p => p.length > 5);
                paragraphs.forEach(para => {

                    if (!applyHighlight(para)) {
                        // Tier 3: Surgical sentence slice (bypasses invisible Wikipedia reference brackets)
                        let sentences = para.match(/[^.?!]+[.?!]+/g) || [para];
                        sentences.forEach(sentence => {
                            applyHighlight(sentence.trim());
                        });
                    }
                });
            }
        });

        window.getSelection().removeAllRanges();
        window.scrollTo(scrollX, scrollY);
    });
}

// 3. STICKY NOTE ENGINE
function createStickyNoteUI(id, text, x, y) {
    let sticky = document.createElement("div");
    sticky.id = `sticky-${id}`;
    sticky.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: 220px; min-height: 180px; background: #fef08a; border: 1px solid #eab308; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 999998; display: flex; flex-direction: column; font-family: sans-serif; border-radius: 4px; overflow: hidden;`;

    let header = document.createElement("div");
    header.style.cssText = `background: #fde047; padding: 6px 10px; cursor: grab; display: flex; justify-content: flex-end; border-bottom: 1px solid #eab308; user-select: none;`;

    let closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style.cssText = `background: none; border: none; cursor: pointer; font-size: 12px; font-weight: bold; color: #9a3412; padding: 0;`;

    header.appendChild(closeBtn);

    let textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.placeholder = "Type your note here...";
    textarea.style.cssText = `flex-grow: 1; background: transparent; border: none; padding: 12px; resize: none; outline: none; color: #1c1917; font-size: 14px; line-height: 1.5;`;

    sticky.appendChild(header);
    sticky.appendChild(textarea);
    document.body.appendChild(sticky);

    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - sticky.getBoundingClientRect().left;
        offsetY = e.clientY - sticky.getBoundingClientRect().top;
        header.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX + window.scrollX;
        let newY = e.clientY - offsetY + window.scrollY;
        sticky.style.left = `${newX}px`;
        sticky.style.top = `${newY}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = "grab";
            saveStickyState();
        }
    });

    function saveStickyState() {
        let noteData = {
            id: id,
            type: "sticky",
            text: textarea.value,
            x: parseInt(sticky.style.left),
            y: parseInt(sticky.style.top),
            source: cleanUrl(window.location.href)
        };

        chrome.storage.local.get(["savedNotes"], (data) => {
            let notes = data.savedNotes || [];
            let updatedNotes = notes.filter(n => n.id !== id);
            updatedNotes.unshift(noteData);
            chrome.storage.local.set({ savedNotes: updatedNotes });
        });
    }

    textarea.addEventListener("input", saveStickyState);

    closeBtn.addEventListener("click", () => {
        sticky.remove();
        chrome.storage.local.get(["savedNotes"], (data) => {
            let notes = data.savedNotes || [];
            let updatedNotes = notes.filter(n => n.id !== id);
            chrome.storage.local.set({ savedNotes: updatedNotes });
        });
    });
}

function spawnStickyNote() {
    let x = window.scrollX + (window.innerWidth / 2) - 110;
    let y = window.scrollY + (window.innerHeight / 2) - 90;
    let newId = Date.now().toString();

    createStickyNoteUI(newId, "", x, y);

    chrome.storage.local.get(["savedNotes"], (data) => {
        let notes = data.savedNotes || [];
        notes.unshift({
            id: newId,
            type: "sticky",
            text: "",
            x: x,
            y: y,
            source: cleanUrl(window.location.href)
        });
        chrome.storage.local.set({ savedNotes: notes });
    });
}

document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === 's') spawnStickyNote();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "spawnSticky") spawnStickyNote();
});


// 4. YOUTUBE NOTES ENGINE
function setupYouTubeNotes() {
    if (!window.location.href.includes("youtube.com/watch")) return;

    let video = document.querySelector("video");
    let rightControls = document.querySelector(".ytp-right-controls");
    let player = document.querySelector(".html5-video-player");

    if (!video || !rightControls || !player || document.getElementById("noteweb-yt-btn")) return;

    let btn = document.createElement("button");
    btn.id = "noteweb-yt-btn";
    btn.className = "ytp-button";
    btn.setAttribute("title", "Add Note");
    btn.style.cssText = "width: auto; padding: 0 10px; font-weight: bold; font-size: 13px; text-transform: uppercase; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;";
    btn.innerHTML = "NOTE";

    rightControls.prepend(btn);

    let panel = document.createElement("div");
    panel.id = "noteweb-yt-panel";
    panel.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 999999; background: rgba(28, 28, 28, 0.9); padding: 20px; border-radius: 12px; display: none; flex-direction: column; gap: 15px; width: 350px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); cursor: default;";

    panel.addEventListener("click", (e) => e.stopPropagation());

    let input = document.createElement("textarea");
    input.placeholder = "Type your note for this timestamp...";
    input.style.cssText = "width: 100%; height: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 10px; font-size: 14px; font-family: Roboto, Arial, sans-serif; resize: none; outline: none; box-sizing: border-box;";

    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());

    let buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex; gap: 10px; justify-content: flex-end;";

    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "background: transparent; color: #fff; border: none; padding: 8px 16px; cursor: pointer; font-size: 14px; font-weight: 500; border-radius: 18px;";

    let saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.cssText = "background: #3ea6ff; color: #000; border: none; border-radius: 18px; padding: 8px 16px; cursor: pointer; font-size: 14px; font-weight: 500;";

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    panel.appendChild(input);
    panel.appendChild(buttonRow);
    player.appendChild(panel);

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        let currentVideo = document.querySelector("video");
        if (currentVideo) currentVideo.pause();
        panel.style.display = "flex";
        input.focus();
    });

    cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let currentVideo = document.querySelector("video");
        panel.style.display = "none";
        input.value = "";
        if (currentVideo) currentVideo.play();
    });

    saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let currentVideo = document.querySelector("video");
        let currentUrl = cleanUrl(window.location.href);

        if (input.value.trim().length > 0 && currentVideo) {
            let time = Math.floor(currentVideo.currentTime);
            let minutes = Math.floor(time / 60);
            let seconds = time - (minutes * 60);
            let timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            let finalNote = `[${timeString}] ${input.value.trim()}`;

            let newNote = {
                id: Date.now().toString(),
                text: finalNote,
                source: currentUrl,
                type: "youtube"
            };

            chrome.storage.local.get(["savedNotes"], (data) => {
                let notes = data.savedNotes || [];
                notes.unshift(newNote);
                chrome.storage.local.set({ savedNotes: notes }, () => {
                    panel.style.display = "none";
                    input.value = "";
                    currentVideo.play();
                    setTimeout(drawYouTubeMarkers, 500);
                });
            });
        }
    });
}

function drawYouTubeMarkers() {
    if (!window.location.href.includes("youtube.com/watch")) return;

    let video = document.querySelector("video");
    let progressList = document.querySelector(".ytp-progress-list");
    let interactionBar = document.querySelector(".ytp-progress-bar");

    if (!video || !progressList || !interactionBar || isNaN(video.duration)) return;

    let tooltip = document.getElementById("noteweb-yt-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "noteweb-yt-tooltip";
        tooltip.style.cssText = `position: fixed; background: rgba(28, 28, 28, 0.95); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; white-space: normal; width: max-content; max-width: 250px; text-align: center; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: none; pointer-events: none; font-family: Roboto, Arial, sans-serif; z-index: 2147483647; transform: translateX(-50%);`;
        document.body.appendChild(tooltip);
    }

    chrome.storage.local.get(["savedNotes"], (data) => {
        let notes = data.savedNotes || [];
        let currentUrl = cleanUrl(window.location.href);

        document.querySelectorAll(".noteweb-marker").forEach(m => m.remove());
        window.notewebMarkerData = [];

        let videoNotes = notes.filter(note => cleanUrl(note.source) === currentUrl && note.type === "youtube");

        videoNotes.forEach(noteObj => {
            let match = noteObj.text.match(/^\[(\d+):(\d+)\]/);
            if (match) {
                let mins = parseInt(match[1]);
                let secs = parseInt(match[2]);
                let totalSeconds = (mins * 60) + secs;

                let percentage = (totalSeconds / video.duration) * 100;
                let cleanText = noteObj.text.replace(/^\[\d+:\d+\]\s*/, '');

                window.notewebMarkerData.push({
                    percentage: percentage,
                    text: cleanText
                });

                let marker = document.createElement("div");
                marker.className = "noteweb-marker";
                marker.style.cssText = `position: absolute; left: ${percentage}%; bottom: 0; width: 6px; height: 100%; background-color: #ffff00; z-index: 50; transform: translateX(-50%); pointer-events: none;`;

                progressList.appendChild(marker);
            }
        });

        if (!interactionBar.dataset.nwTracked) {
            interactionBar.dataset.nwTracked = "true";

            interactionBar.addEventListener("mousemove", (e) => {
                let rect = interactionBar.getBoundingClientRect();
                let hoverX = e.clientX - rect.left;
                let hoverPercentage = (hoverX / rect.width) * 100;

                let closestNote = null;
                let minDiff = 1.0;

                window.notewebMarkerData.forEach(marker => {
                    let diff = Math.abs(marker.percentage - hoverPercentage);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestNote = marker;
                    }
                });

                if (closestNote) {
                    tooltip.textContent = closestNote.text;
                    tooltip.style.left = e.clientX + "px";
                    tooltip.style.top = (rect.top - 45) + "px";
                    tooltip.style.display = "block";
                } else {
                    tooltip.style.display = "none";
                }
            });

            interactionBar.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });
        }
    });
}

// 5. COPY WITH SOURCE ENGINE
let isCopySourceEnabled = false;

chrome.storage.local.get(["isCopySourceEnabled"], (data) => {
    isCopySourceEnabled = data.isCopySourceEnabled || false;
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.isCopySourceEnabled) {
        isCopySourceEnabled = changes.isCopySourceEnabled.newValue;
    }
});

document.addEventListener("copy", (e) => {
    if (!isCopySourceEnabled) return;

    let selection = window.getSelection().toString().trim();

    if (selection.length > 0) {
        let customCopyText = `${selection}\n\nSource: ${cleanUrl(window.location.href)}`;
        e.clipboardData.setData("text/plain", customCopyText);
        e.preventDefault();
    }
});

// INITIALIZATION
restoreHighlightsForPage();

setInterval(() => {
    setupYouTubeNotes();
    drawYouTubeMarkers();
}, 2000);
