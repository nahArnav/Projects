let toggle = document.getElementById("highlight-toggle");
let copyToggle = document.getElementById("copy-toggle");
let listofnotes = document.getElementById("notes-list");
let filterDropdown = document.getElementById("url-filter");
let searchBar = document.getElementById("search-bar");
let exportBtn = document.getElementById("export-btn");
let clearBtn = document.getElementById("clear-btn");
let stickyBtn = document.getElementById("sticky-btn");

let tabWeb = document.getElementById("tab-web");
let tabSticky = document.getElementById("tab-sticky");

let currentTab = "web";

function cleanUrl(url) {
    if (!url) return "";
    if (url.includes("youtube.com/watch")) url = url.split('&')[0];
    return url.split('#')[0];
}

tabWeb.addEventListener("click", () => {
    currentTab = "web";
    tabWeb.className = "tab-btn tab-active";
    tabSticky.className = "tab-btn tab-inactive";
    stickyBtn.style.display = "none";
    updateView();
});

tabSticky.addEventListener("click", () => {
    currentTab = "sticky";
    tabSticky.className = "tab-btn tab-active";
    tabWeb.className = "tab-btn tab-inactive";
    stickyBtn.style.display = "block";
    updateView();
});

function renderNotes(notesArray) {
    listofnotes.innerHTML = "";

    notesArray.forEach((noteObj) => {
        let listItem = document.createElement("li");

        let textSpan = document.createElement("span");
        textSpan.textContent = noteObj.text || "(Empty Note)";
        textSpan.style.flexGrow = "1";

        let deleteBtn = document.createElement("button");
        deleteBtn.textContent = "x";
        deleteBtn.style.background = "none";
        deleteBtn.style.border = "none";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.width = "auto";
        deleteBtn.style.padding = "0 0 0 10px";
        deleteBtn.style.fontSize = "14px";
        deleteBtn.style.color = "#ef4444";

        deleteBtn.addEventListener("click", () => {
            chrome.storage.local.get(["savedNotes"], (data) => {
                let allNotes = data.savedNotes || [];
                let updatedNotes = allNotes.filter(n => n.id !== noteObj.id && n.text !== noteObj.text);
                chrome.storage.local.set({ savedNotes: updatedNotes }, () => listItem.remove());
            });
        });

        listItem.style.display = "flex";
        listItem.style.alignItems = "flex-start";
        listItem.style.justifyContent = "space-between";
        listItem.style.background = currentTab === "sticky" ? "#fef08a" : "#1e293b";
        listItem.style.color = currentTab === "sticky" ? "#1c1917" : "#f8fafc";
        listItem.style.padding = "10px";
        listItem.style.borderRadius = "6px";
        listItem.style.borderLeft = currentTab === "sticky" ? "4px solid #eab308" : "4px solid #6366f1";

        listItem.appendChild(textSpan);
        listItem.appendChild(deleteBtn);
        listofnotes.appendChild(listItem);
    });
}

function getFilteredNotes(notes) {
    let searchQuery = searchBar.value.toLowerCase();
    let selectedUrl = filterDropdown.value;

    let filtered = notes.filter(note => {
        if (note.type === "youtube") return false;

        let isSticky = note.type === "sticky";
        if (currentTab === "web" && isSticky) return false;
        if (currentTab === "sticky" && !isSticky) return false;

        let rawText = note.text || "";
        let matchesSearch = rawText.toLowerCase().includes(searchQuery);
        let matchesUrl = selectedUrl === "all" || cleanUrl(note.source) === cleanUrl(selectedUrl);
        return matchesSearch && matchesUrl;
    });

    // BUG FIX: Null-Safe Math Engine to force newest notes to the top
    return filtered.sort((a, b) => {
        let idA = parseInt(a.id) || 0; // If old note has no ID, treat as 0
        let idB = parseInt(b.id) || 0;
        return idB - idA; // Sorts descending (Newest first)
    });
}

function updateView() {
    chrome.storage.local.get(["savedNotes"], (data) => {
        let notes = data.savedNotes || [];
        renderNotes(getFilteredNotes(notes));
    });
}

chrome.storage.local.get(["isHighlightEnabled", "isCopySourceEnabled", "savedNotes"], (data) => {
    toggle.checked = data.isHighlightEnabled || false;
    copyToggle.checked = data.isCopySourceEnabled || false;
    let notes = data.savedNotes || [];

    let allUrls = notes.map(noteObj => cleanUrl(noteObj.source));
    let uniqueUrls = [...new Set(allUrls.filter(u => u !== ""))];

    uniqueUrls.forEach((url) => {
        let option = document.createElement("option");
        option.value = url;
        option.textContent = url;
        filterDropdown.appendChild(option);
    });
    updateView();
});

filterDropdown.addEventListener("change", updateView);
searchBar.addEventListener("input", updateView);

toggle.addEventListener("change", () => {
    chrome.storage.local.set({isHighlightEnabled: toggle.checked});
});

copyToggle.addEventListener("change", () => {
    chrome.storage.local.set({isCopySourceEnabled: copyToggle.checked});
});

stickyBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "spawnSticky" });
            window.close();
        }
    });
});

exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(["savedNotes"], (data) => {
        let allNotes = data.savedNotes || [];
        let notesToExport = getFilteredNotes(allNotes);

        if (notesToExport.length === 0) {
            alert("Nothing to export in this tab.");
            return;
        }

        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        let doc = new jsPDF();

        doc.setFont("NotoSans-Regular", "normal");

        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, 210, 35, "F");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);

        let title = currentTab === "web" ? "Noteweb: Web Notes" : "Noteweb: My Ideas";
        doc.text(title, 15, 24);

        let y = 50;
        notesToExport.forEach((noteObj) => {
            let rawText = noteObj.text || "(Empty Note)";
            let cleanNote = String(rawText).replace(/\n/g, " ");
            let sourceText = cleanUrl(noteObj.source) || "Unknown Source";

            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            let splitUrl = doc.splitTextToSize(`Source: ${sourceText}`, 180);

            splitUrl.forEach((line) => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, 20, y);
                y += 5;
            });

            y += 2;
            doc.setFontSize(12);
            doc.setTextColor(50, 50, 50);
            let splitNote = doc.splitTextToSize(cleanNote, 180);

            doc.setFillColor(99, 102, 241);
            doc.circle(15, y - 1.5, 1.5, "F");

            splitNote.forEach((line) => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, 20, y);
                y += 7;
            });
            y += 8;
        });

        doc.save(`Noteweb_${currentTab}_export.pdf`);
    });
});

clearBtn.addEventListener("click", () => {
    let confirmDelete = confirm(`Are you sure you want to delete all notes in the ${currentTab} tab?`);
    if (confirmDelete) {
        chrome.storage.local.get(["savedNotes"], (data) => {
            let notes = data.savedNotes || [];
            let remainingNotes = notes.filter(n =>
                currentTab === "web" ? n.type === "sticky" : (!n.type || n.type !== "sticky")
            );
            chrome.storage.local.set({ savedNotes: remainingNotes }, updateView);
        });
    }
});
