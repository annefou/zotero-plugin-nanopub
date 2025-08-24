/* Bootstrap for Zotero Nanopub Plugin - Complete Features */

var Zotero;
var Services;

function install(data, reason) {}
function uninstall(data, reason) {}

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec } = {}, reason) {
    // Get Zotero
    if (!Zotero) {
        Zotero = Components.classes["@zotero.org/Zotero;1"]
            .getService(Components.interfaces.nsISupports)
            .wrappedJSObject;
    }
    
    if (!Services) {
        Services = globalThis.Services;
    }
    
    await Zotero.initializationPromise;
    await Zotero.uiReadyPromise;
    
    // Create main plugin object
    Zotero.Nanopub = {
        version: version,
        menuRegistered: false,
        templateUrl: "https://w3id.org/np/RA24onqmqTMsraJ7ypYFOuckmNWpo4Zv5gsLqhXt7xYPU",
        
        /**
         * Import nanopublication by URL
         */
        importNanopublication: async function() {
            try {
                const ps = Services.prompt;
                const input = { value: "https://w3id.org/np/" };
                const result = ps.prompt(
                    null,
                    "Import Nanopublication",
                    "Enter the nanopublication URL (e.g., https://w3id.org/np/RALoT4_wJWI...):",
                    input,
                    null,
                    { value: false }
                );
                
                if (!result || !input.value) return;
                
                const url = input.value.trim();
                
                // Fetch and parse nanopublication
                const trigUrl = url.replace('https://w3id.org/np/', 'https://np.knowledgepixels.com/') + '.trig';
                const response = await Zotero.HTTP.request('GET', trigUrl);
                
                if (response.status !== 200) {
                    throw new Error("Could not fetch nanopublication");
                }
                
                // Parse basic info from TriG
                const content = response.responseText;
                const labelMatch = content.match(/rdfs:label\s+"([^"]+)"/);
                const dateMatch = content.match(/dct:created\s+"([^"]+)"/);
                const doiMatch = content.match(/cito:quotes\s+<https:\/\/doi\.org\/([^>]+)>/);
                const quotationMatch = content.match(/cito:hasQuotedText\s+"([^"]+)"/);
                
                // Create Zotero item
                const item = new Zotero.Item('webpage');
                item.setField('title', labelMatch ? labelMatch[1] : 'Nanopublication');
                item.setField('url', url);
                item.setField('accessDate', Zotero.Date.dateToSQL(new Date()));
                
                if (dateMatch) {
                    item.setField('date', dateMatch[1].split('T')[0]);
                }
                
                // Add tags
                item.addTag('nanopublication');
                if (doiMatch) {
                    item.addTag('quotes:' + doiMatch[1]);
                }
                
                await item.saveTx();
                
                // Add note with content
                if (quotationMatch || doiMatch) {
                    const note = new Zotero.Item('note');
                    let noteContent = '<h2>Nanopublication Content</h2>';
                    if (doiMatch) {
                        noteContent += `<p><b>References:</b> <a href="https://doi.org/${doiMatch[1]}">${doiMatch[1]}</a></p>`;
                    }
                    if (quotationMatch) {
                        noteContent += `<p><b>Quotation:</b> "${quotationMatch[1]}"</p>`;
                    }
                    note.setNote(noteContent);
                    note.parentID = item.id;
                    await note.saveTx();
                }
                
                Zotero.alert(null, "Success", "Nanopublication imported successfully!");
                
            } catch (e) {
                Zotero.alert(null, "Error", "Failed to import: " + e.message);
            }
        },
        
        /**
         * Search for nanopublications referencing selected item
         */
        searchNanopublications: async function() {
            try {
                const items = Zotero.getActiveZoteroPane().getSelectedItems();
                
                if (items.length === 0) {
                    Zotero.alert(null, "Error", "Please select an item first");
                    return;
                }
                
                const item = items[0];
                const doi = item.getField('DOI');
                
                if (!doi) {
                    Zotero.alert(null, "Error", "Selected item has no DOI");
                    return;
                }
                
                // Build and execute SPARQL query
                const query = `
                    PREFIX np: <http://www.nanopub.org/nschema#>
                    PREFIX cito: <http://purl.org/spar/cito/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    
                    SELECT DISTINCT ?np ?quotation ?comment WHERE {
                        GRAPH ?assertion {
                            ?s cito:quotes <https://doi.org/${doi}> .
                            OPTIONAL { <https://doi.org/${doi}> cito:hasQuotedText ?quotation . }
                            OPTIONAL { <https://doi.org/${doi}> rdfs:comment ?comment . }
                        }
                        ?np np:hasAssertion ?assertion .
                    }
                    LIMIT 100
                `;
                
                const queryUrl = "https://query.petapico.org/repo/full";
                const response = await Zotero.HTTP.request('POST', queryUrl, {
                    body: query,
                    headers: {
                        'Content-Type': 'application/sparql-query',
                        'Accept': 'application/sparql-results+json'
                    }
                });
                
                if (response.status !== 200) {
                    throw new Error("Query failed");
                }
                
                const data = JSON.parse(response.responseText);
                const results = data.results?.bindings || [];
                
                if (results.length === 0) {
                    Zotero.alert(null, "Search Results", "No nanopublications found for this item");
                    return;
                }
                
                // Create a more detailed results display
                let html = `<!DOCTYPE html>
                <html>
                <head>
                    <title>Nanopublications for: ${item.getField('title')}</title>
                    <style>
                        body { font-family: -apple-system, sans-serif; margin: 20px; }
                        h1 { color: #2c3e50; font-size: 1.5em; }
                        .nanopub { 
                            border: 1px solid #ddd; 
                            padding: 15px; 
                            margin: 15px 0; 
                            border-radius: 5px;
                            background: #f9f9f9;
                        }
                        .np-url { 
                            font-family: monospace; 
                            font-size: 0.9em;
                            word-break: break-all;
                        }
                        .quotation { 
                            font-style: italic; 
                            color: #555; 
                            margin: 10px 0;
                            padding: 10px;
                            background: white;
                            border-left: 3px solid #3498db;
                        }
                        .comment { 
                            margin: 10px 0;
                            color: #333;
                        }
                        a { color: #3498db; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                        .stats { 
                            background: #e8f4f8; 
                            padding: 10px; 
                            border-radius: 5px;
                            margin-bottom: 20px;
                        }
                        button {
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 5px 10px;
                            border-radius: 3px;
                            cursor: pointer;
                            margin-left: 10px;
                        }
                        button:hover { background: #2980b9; }
                    </style>
                </head>
                <body>
                    <h1>Nanopublications citing: ${item.getField('title')}</h1>
                    <div class="stats">
                        <strong>DOI:</strong> ${doi}<br>
                        <strong>Found:</strong> ${results.length} nanopublication(s)
                    </div>
                `;
                
                // Process each result
                results.forEach((result, index) => {
                    const npUrl = result.np?.value || '';
                    const npId = npUrl.split('/').pop();
                    const quotation = result.quotation?.value || '';
                    const comment = result.comment?.value || '';
                    
                    html += `
                    <div class="nanopub">
                        <h3>Nanopublication ${index + 1}</h3>
                        <div class="np-url">
                            <a href="${npUrl}" target="_blank">${npId}</a>
                            <button onclick="navigator.clipboard.writeText('${npUrl}')">Copy URL</button>
                        </div>
                        ${quotation ? `<div class="quotation">"${quotation}"</div>` : ''}
                        ${comment ? `<div class="comment"><strong>Comment:</strong> ${comment}</div>` : ''}
                    </div>
                    `;
                });
                
                html += `
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 0.9em;">
                        Query executed at: ${new Date().toLocaleString()}<br>
                        Endpoint: https://query.petapico.org/repo/full
                    </p>
                </body>
                </html>`;
                
                // Save and open results
                const tmpFile = Zotero.getTempDirectory();
                tmpFile.append('nanopub-search-results.html');
                Zotero.File.putContents(tmpFile, html);
                Zotero.launchFile(tmpFile);
                
            } catch (e) {
                Zotero.alert(null, "Error", "Search failed: " + e.message);
            }
        },
        
        /**
         * Create nanopublication from PDF selection
         */
        createFromPDFSelection: async function() {
            try {
                // Get active reader tab
                const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
                
                if (!reader) {
                    Zotero.alert(null, "Error", "Please open a PDF first");
                    return;
                }
                
                // Get selected text from PDF reader
                const selection = reader._iframeWindow.wrappedJSObject.getSelection();
                const selectedText = selection.toString().trim();
                
                if (!selectedText) {
                    Zotero.alert(null, "Error", "Please select text in the PDF first");
                    return;
                }
                
                // Get parent item
                const attachment = Zotero.Items.get(reader.itemID);
                const parentItem = attachment.parentItem;
                
                if (!parentItem) {
                    Zotero.alert(null, "Error", "PDF has no parent item");
                    return;
                }
                
                const doi = parentItem.getField('DOI');
                if (!doi) {
                    Zotero.alert(null, "Error", "Item has no DOI - required for nanopublication");
                    return;
                }
                
                // Handle long quotations
                let quotation = selectedText;
                let quotationEnd = "";
                
                if (selectedText.length > 500) {
                    quotation = selectedText.substring(0, 240) + "...";
                    quotationEnd = "..." + selectedText.substring(selectedText.length - 240);
                }
                
                // Prompt for interpretation
                const ps = Services.prompt;
                const interpretation = { value: "" };
                const result = ps.prompt(
                    null,
                    "Add Interpretation",
                    `Selected text:\n"${selectedText.substring(0, 200)}${selectedText.length > 200 ? '...' : ''}"\n\n` +
                    "Why is this quotation relevant? (Your interpretation):",
                    interpretation,
                    null,
                    { value: false }
                );
                
                if (!result || !interpretation.value) return;
                
                // Build Nanodash URL with template
                const params = new URLSearchParams({
                    template: Zotero.Nanopub.templateUrl,
                    'template-version': 'latest',
                    'param_paper': `https://doi.org/${doi}`,
                    'param_quotation': quotation,
                    'param_comment': interpretation.value
                });
                
                if (quotationEnd) {
                    params.append('param_quotation-end', quotationEnd);
                }
                
                const nanodashUrl = `https://nanodash.knowledgepixels.com/publish?${params.toString()}`;
                
                // Open Nanodash
                Zotero.launchURL(nanodashUrl);
                
                // Prompt for result after delay
                Zotero.setTimeout(() => {
                    const nanopubUrl = prompt("After publishing, paste the nanopublication URL here:");
                    
                    if (nanopubUrl) {
                        // Link to parent item
                        Zotero.Attachments.linkFromURL({
                            url: nanopubUrl,
                            parentItemID: parentItem.id,
                            title: "Nanopub: " + selectedText.substring(0, 50) + "..."
                        });
                        
                        // Create note
                        const note = new Zotero.Item('note');
                        note.setNote(
                            `<h2>Nanopublication Created</h2>` +
                            `<p><b>URL:</b> <a href="${nanopubUrl}">${nanopubUrl}</a></p>` +
                            `<p><b>Quotation:</b> "${selectedText}"</p>` +
                            `<p><b>Interpretation:</b> ${interpretation.value}</p>`
                        );
                        note.parentID = parentItem.id;
                        note.saveTx();
                        
                        Zotero.alert(null, "Success", "Nanopublication linked to item!");
                    }
                }, 5000);
                
            } catch (e) {
                Zotero.alert(null, "Error", "Failed: " + e.message);
            }
        },
        
        /**
         * Execute custom SPARQL query
         */
        executeSPARQL: async function() {
            try {
                const ps = Services.prompt;
                const query = { value: `PREFIX np: <http://www.nanopub.org/nschema#>
PREFIX cito: <http://purl.org/spar/cito/>

SELECT ?np WHERE {
  ?np a np:Nanopublication .
} LIMIT 10` };
                
                const result = ps.prompt(
                    null,
                    "Execute SPARQL Query",
                    "Enter your SPARQL query for https://query.petapico.org/repo/full:",
                    query,
                    null,
                    { value: true }  // multiline
                );
                
                if (!result || !query.value) return;
                
                // Execute query
                const response = await Zotero.HTTP.request('POST', "https://query.petapico.org/repo/full", {
                    body: query.value,
                    headers: {
                        'Content-Type': 'application/sparql-query',
                        'Accept': 'application/sparql-results+json'
                    }
                });
                
                if (response.status !== 200) {
                    throw new Error(`Query failed with status ${response.status}`);
                }
                
                const data = JSON.parse(response.responseText);
                const results = data.results?.bindings || [];
                
                // Display results
                let html = `<!DOCTYPE html>
                <html>
                <head>
                    <title>SPARQL Query Results</title>
                    <style>
                        body { font-family: monospace; margin: 20px; }
                        pre { background: #f5f5f5; padding: 15px; overflow: auto; }
                        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #f0f0f0; }
                        .stats { background: #e8f4f8; padding: 10px; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <h1>SPARQL Query Results</h1>
                    <div class="stats">
                        <strong>Endpoint:</strong> https://query.petapico.org/repo/full<br>
                        <strong>Results:</strong> ${results.length} rows<br>
                        <strong>Time:</strong> ${new Date().toLocaleString()}
                    </div>
                    <h3>Query:</h3>
                    <pre>${query.value}</pre>
                    <h3>Results:</h3>
                `;
                
                if (results.length > 0) {
                    // Get column headers
                    const headers = Object.keys(results[0]);
                    
                    html += '<table><thead><tr>';
                    headers.forEach(h => {
                        html += `<th>${h}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                    
                    // Add rows
                    results.forEach(row => {
                        html += '<tr>';
                        headers.forEach(h => {
                            const value = row[h]?.value || '';
                            const type = row[h]?.type || '';
                            if (type === 'uri') {
                                html += `<td><a href="${value}" target="_blank">${value}</a></td>`;
                            } else {
                                html += `<td>${value}</td>`;
                            }
                        });
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                } else {
                    html += '<p>No results found.</p>';
                }
                
                html += '</body></html>';
                
                // Save and open
                const tmpFile = Zotero.getTempDirectory();
                tmpFile.append('sparql-results.html');
                Zotero.File.putContents(tmpFile, html);
                Zotero.launchFile(tmpFile);
                
            } catch (e) {
                Zotero.alert(null, "Error", "Query failed: " + e.message);
            }
        },
        
        /**
         * Register menu items
         */
        registerMenu: function() {
            if (this.menuRegistered) return true;
            
            try {
                const doc = Zotero.getMainWindow().document;
                const itemMenu = doc.getElementById("zotero-itemmenu");
                
                if (!itemMenu) return false;
                
                // Remove old items if they exist
                ['nanopub-sep', 'nanopub-create', 'nanopub-search', 'nanopub-import', 'nanopub-pdf'].forEach(id => {
                    const el = doc.getElementById(id);
                    if (el) el.remove();
                });
                
                // Add separator
                const sep = doc.createXULElement("menuseparator");
                sep.id = "nanopub-sep";
                itemMenu.appendChild(sep);
                
                // Add "Create from PDF Selection" menu item
                const pdfItem = doc.createXULElement("menuitem");
                pdfItem.id = "nanopub-pdf";
                pdfItem.setAttribute("label", "Create Nanopub from PDF Selection");
                pdfItem.addEventListener("command", () => Zotero.Nanopub.createFromPDFSelection());
                itemMenu.appendChild(pdfItem);
                
                // Add "Search Nanopublications" menu item
                const searchItem = doc.createXULElement("menuitem");
                searchItem.id = "nanopub-search";
                searchItem.setAttribute("label", "Search Nanopublications for This Item");
                searchItem.addEventListener("command", () => Zotero.Nanopub.searchNanopublications());
                itemMenu.appendChild(searchItem);
                
                // Add to Tools menu
                const toolsMenu = doc.getElementById("menu_ToolsPopup");
                if (toolsMenu) {
                    const toolsSep = doc.createXULElement("menuseparator");
                    toolsSep.id = "nanopub-tools-sep";
                    toolsMenu.appendChild(toolsSep);
                    
                    const importItem = doc.createXULElement("menuitem");
                    importItem.id = "nanopub-import";
                    importItem.setAttribute("label", "Import Nanopublication by URL...");
                    importItem.addEventListener("command", () => Zotero.Nanopub.importNanopublication());
                    toolsMenu.appendChild(importItem);
                    
                    const sparqlItem = doc.createXULElement("menuitem");
                    sparqlItem.id = "nanopub-sparql";
                    sparqlItem.setAttribute("label", "Execute SPARQL Query...");
                    sparqlItem.addEventListener("command", () => Zotero.Nanopub.executeSPARQL());
                    toolsMenu.appendChild(sparqlItem);
                }
                
                this.menuRegistered = true;
                return true;
            } catch (e) {
                Zotero.logError(e);
                return false;
            }
        }
    };
    
    // Register menu on popup
    const doc = Zotero.getMainWindow().document;
    const itemMenu = doc.getElementById("zotero-itemmenu");
    if (itemMenu) {
        itemMenu.addEventListener("popupshowing", function() {
            Zotero.Nanopub.registerMenu();
        });
    }
    
    // Add keyboard shortcuts
    doc.addEventListener("keydown", function(e) {
        // Ctrl+Alt+N - Create from PDF
        if (e.key === 'n' && e.altKey && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            Zotero.Nanopub.createFromPDFSelection();
        }
        // Ctrl+Alt+S - Search nanopubs
        if (e.key === 's' && e.altKey && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            Zotero.Nanopub.searchNanopublications();
        }
    });
}

function shutdown({ id, version, resourceURI, rootURI = resourceURI.spec } = {}, reason) {
    if (reason === APP_SHUTDOWN) return;
    
    try {
        const doc = Zotero.getMainWindow().document;
        ['nanopub-sep', 'nanopub-create', 'nanopub-search', 'nanopub-import', 
         'nanopub-pdf', 'nanopub-tools-sep'].forEach(id => {
            const el = doc.getElementById(id);
            if (el) el.remove();
        });
        delete Zotero.Nanopub;
    } catch (e) {}
}
