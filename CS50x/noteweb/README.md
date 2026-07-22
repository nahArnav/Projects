# NoteWeb 🧠✨
#### Video Demo:  <URL HERE>
#### Description:

**A personal touch to the knowledge layer for the web. Make learning easier, smarter, and way more organized.**

The internet is filled with incredible information, but capturing and organizing it is a mess. NoteWeb is a powerful, lightweight Chrome Extension built on Manifest V3 that transforms your browser into a persistent, interactive personal knowledge vault. Whether you are researching complex articles, studying long-form YouTube tutorials, or just capturing raw ideas, NoteWeb seamlessly integrates into your workflow to ensure you never lose a thought again.

---

## 🚀 Core Features & Technical Highlights

### 🖍️ 1. Persistent Smart Highlighting (with 3-Tier Fallback)
Highlight any text on the web, and NoteWeb will remember it forever.
*   **The Problem:** Traditional highlighters break when dealing with invisible HTML tags, citations (like on Wikipedia), or dynamic page layouts.
*   **The Solution:** NoteWeb utilizes a custom **3-Tier Fallback Rehydration Engine**. When you revisit a page, it first tries to find the exact block. If the site's HTML structure blocks it, the engine dynamically slices your note into paragraphs, and finally into individual sentences, surgically re-applying the highlight to the DOM.

### 📌 2. Spatial Sticky Notes
Need to map out an idea right next to the source material?
*   Hit `Alt + S` or use the popup menu to spawn a draggable sticky note directly injected into the webpage's DOM.
*   The extension utilizes a custom coordinate-tracking physics engine to remember the exact `X` and `Y` pixel location of your note. When you reload the page, your sticky note is exactly where you left it.

### ▶️ 3. Native YouTube Chaptering & Interaction
NoteWeb treats video tutorials like interactive textbooks.
*   **UI Injection:** A custom "NOTE" button is natively injected directly into the YouTube player controls. Clicking it pauses the video and opens an overlay to capture your thoughts.
*   **Timestamp Math Engine:** Notes automatically capture the exact video timestamp.
*   **Smart Hover:** NoteWeb injects visual markers directly into the YouTube progress bar. Hovering over the timeline calculates the spatial percentage and displays a tooltip of your exact note at that specific second.

### 🗄️ 4. The Knowledge Vault & PDF Generation
Your data belongs to you, stored entirely in `chrome.storage.local`.
*   **Advanced Filtering:** Open the extension popup to instantly search your entire vault across all websites, or filter down to the specific URL you are currently viewing.
*   **Null-Safe Sorting:** The vault uses a mathematical sorting engine based on epoch timestamps to guarantee your freshest ideas are always pushed to the top of the stack.
*   **Offline PDF Export:** With one click, compile your filtered notes into a clean, formatted PDF document. NoteWeb utilizes `jsPDF` with a Virtual File System (VFS) to render beautiful, modern typography (Noto Sans) completely offline.

### 📋 5. Toggleable Source Attribution
Turn on the "Append Source on Copy" toggle. NoteWeb runs a lightweight background interceptor that instantly appends the current cleaned URL to your clipboard payload whenever you copy text, ensuring you always have your citations ready.

---

## 🛠️ How to Install (Developer Mode)

NoteWeb is currently unreleased on the Chrome Web Store. To use it right now, you can install it locally as an "Unpacked Extension" directly from this repository:

1. **Download the Source Code:** Clone this repository using `git clone` or click the green "Code" button and select "Download ZIP". Extract it to a folder on your computer.
2. **Access Chrome Extensions:** Open Google Chrome and type `chrome://extensions/` into the URL address bar.
3. **Enable Developer Mode:** Toggle the **"Developer mode"** switch located in the top right corner of the screen.
4. **Load the Extension:** Click the **"Load unpacked"** button that appears in the top left corner.
5. **Select the Folder:** Select the unzipped `NoteWeb` folder (the one containing the `manifest.json` file).
6. **Pin It!:** Click the puzzle piece icon 🧩 in your Chrome toolbar and pin NoteWeb for quick access.

---

## 📖 Quick Start Guide

*   **Highlighting:** Click the NoteWeb extension icon, check the "Enable Highlighting" box, and simply highlight any text on any webpage.
*   **Sticky Notes:** Press `Alt + S` on your keyboard to drop a sticky note, or click "+ Spawn Sticky Note Here" in the "My Ideas" tab of the popup. Drag it around by the yellow header.
*   **YouTube Notes:** Open any YouTube video. Look for the "NOTE" button next to the volume and caption controls. Click it to drop a timestamped note. Hover over the red/yellow markers on the timeline to read them later!
*   **Exporting:** Open the extension popup, use the dropdown to filter by the website you want (or select "All Websites"), and click **Export PDF** to generate your study guide.

---

## 💻 Architecture & Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Storage:** `chrome.storage.local` API (No external databases, 100% privacy-focused)
*   **Architecture:** Chrome Extension Manifest V3 (Content Scripts, Popup UI, Message Passing)
*   **Data Sanitization:** Custom URL-cleaning algorithms to prevent duplicate database entries from dynamic URL parameters (e.g., YouTube's `&t=` tags or Wikipedia's `#` hashes).
*   **External Libraries:** `jsPDF` (for client-side PDF generation)

---

## 👨‍💻 Author

Built by **Arnav Patidar** (Pune, India)
*   GitHub: [@nahArnav](https://github.com/nahArnav)
*   edX: [Arnavfr](https://profile.edx.org/u/Arnavfr)

*If you found this project helpful or interesting, feel free to drop a ⭐ on the repository! Contributions and pull requests are always welcome.*
