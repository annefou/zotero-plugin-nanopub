import { log, error } from "../utils/logger";
import { getString } from "../utils/locale";

export class NanopubManager {
  private addon: any;
  private templateUrl = "https://w3id.org/np/RA24onqmqTMsraJ7ypYFOuckmNWpo4Zv5gsLqhXt7xYPU";

  constructor(addon: any) {
    this.addon = addon;
  }

  async initialize() {
    log("NanopubManager initializing...");
    log("NanopubManager initialized");
  }

  /**
   * FIXED: Import nanopublication by URL with proper collection support
   */
  async importNanopublicationByURL() {
    try {
      log("Starting nanopublication import by URL");

      // FIXED: Use Zotero's prompt service correctly
      const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);
      
      const input = { value: "https://w3id.org/np/" };
      const result = ps.prompt(
        Zotero.getMainWindow(),
        "Import Nanopublication",
        "Enter the nanopublication URL (e.g., https://w3id.org/np/RALoT4_wJWI...):",
        input,
        null,
        { value: false }
      );

      if (!result || !input.value) {
        log("Import cancelled by user");
        return;
      }

      const url = input.value.trim();
      log(`Importing nanopublication from: ${url}`);

      // Fetch nanopublication data
      const nanopubData = await this.fetchNanopublication(url);
      
      // FIXED: Get current collection BEFORE creating item
      const zoteroPane = Zotero.getActiveZoteroPane();
      const selectedCollection = zoteroPane.getSelectedCollection();
      
      // Create Zotero item
      const item = new Zotero.Item('webpage');
      item.setField('title', nanopubData.label || 'Nanopublication');
      item.setField('url', url);
      item.setField('abstractNote', 'Imported nanopublication');
      
      if (nanopubData.date) {
        item.setField('date', nanopubData.date);
      }
      
      // FIXED: Set collection BEFORE saving if one is selected
      if (selectedCollection) {
        item.libraryID = selectedCollection.libraryID;
        await item.save();
        await selectedCollection.addItem(item.id);
        log(`Added item to collection: "${selectedCollection.name}"`);
        this.showSuccess(`Nanopublication imported successfully to collection "${selectedCollection.name}"`);
      } else {
        await item.save();
        log("No collection selected, item added to My Library");
        this.showSuccess("Nanopublication imported successfully to My Library");
      }
      
      // Add notes with additional info
      if (nanopubData.quotation) {
        const note = new Zotero.Item('note');
        note.setNote(`<p><strong>Quoted Text:</strong></p><blockquote>${nanopubData.quotation}</blockquote>`);
        note.parentKey = item.key;
        note.libraryID = item.libraryID;
        await note.save();
      }
      
      if (nanopubData.doi) {
        const note = new Zotero.Item('note');
        note.setNote(`<p><strong>Related DOI:</strong> <a href="https://doi.org/${nanopubData.doi}">https://doi.org/${nanopubData.doi}</a></p>`);
        note.parentKey = item.key;
        note.libraryID = item.libraryID;
        await note.save();
      }
      
      log("Nanopublication import completed successfully");

    } catch (err) {
      error("Failed to import nanopublication:", err);
      this.showError("Import failed: " + (err as Error).message);
    }
  }

  /**
   * ENHANCED: Search nanopublications with better query and proper note attachment
   */
  async searchNanopublicationsForSelected() {
    try {
      log("Starting nanopublication search for selected item");

      const items = Zotero.getActiveZoteroPane().getSelectedItems();
      
      if (!items.length) {
        this.showError("Please select an item first");
        return;
      }

      const item = items[0];
      let doi = item.getField('DOI');
      
      if (!doi) {
        this.showError("Selected item has no DOI");
        return;
      }

      // FIXED: Use your improved query
      let cleanTerm = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      log(`Searching for DOI term: ${cleanTerm}`);

      let sparqlQuery = `
        PREFIX np: <http://www.nanopub.org/nschema#>
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>

        SELECT DISTINCT ?np ?date ?authorName
        WHERE {
          ?np a np:Nanopublication ;
              np:hasAssertion ?assertion .

          GRAPH ?assertion {
            ?s ?p ?o .
            FILTER (
              CONTAINS(LCASE(STR(?s)), LCASE("${cleanTerm}")) ||
              CONTAINS(LCASE(STR(?p)), LCASE("${cleanTerm}")) ||
              CONTAINS(LCASE(STR(?o)), LCASE("${cleanTerm}"))
            )
          }

          OPTIONAL {
            ?np dcterms:created ?date .
            ?np dcterms:creator ?creator .
            ?creator foaf:name ?authorName .
          }
        }
        ORDER BY DESC(?date)
        LIMIT 10
      `;

      // Execute search
      const results = await this.executeNanopubSearch(sparqlQuery, cleanTerm);
      
      if (results.length === 0) {
        this.showError(`No nanopublications found for DOI: ${doi}\n\nItem: ${item.getField('title')}\nSearched term: ${cleanTerm}`);
        return;
      }
      
      // Ask user for each nanopublication found
      let addedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const npUrl = result.np?.value || '';
        const date = result.date?.value || '';
        const authorName = result.authorName?.value || 'Unknown';
        
        // Fetch additional details from the nanopub itself
        let nanopubDetails = null;
        try {
          nanopubDetails = await this.fetchNanopublication(npUrl);
        } catch (e) {
          log("Could not fetch nanopub details:", e);
        }
        
        const title = nanopubDetails?.label || `Nanopublication by ${authorName}`;
        const quotation = nanopubDetails?.quotation || '';
        const comment = nanopubDetails?.comment || '';
        
        // Create detailed description for user
        let description = `Nanopublication ${i + 1} of ${results.length}:\n\n`;
        description += `Title: ${title}\n`;
        description += `URL: ${npUrl}\n`;
        description += `Author: ${authorName}\n`;
        if (date) description += `Created: ${new Date(date).toLocaleDateString()}\n`;
        if (quotation) description += `Quotation: "${quotation}"\n`;
        if (comment) description += `Comment: ${comment}\n`;
        description += `\nDo you want to add this nanopublication as a note to this item?`;
        
        const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
          .getService(Components.interfaces.nsIPromptService);
        
        const addThis = ps.confirm(
          Zotero.getMainWindow(),
          "Add Nanopublication?",
          description
        );
        
        if (addThis) {
          try {
            // FIXED: Create a note instead of a child item
            const note = new Zotero.Item('note');
            
            // Build HTML content for the note
            let noteHTML = `<h3>${title}</h3>`;
            noteHTML += `<p><strong>Nanopublication URL:</strong> <a href="${npUrl}">${npUrl}</a></p>`;
            noteHTML += `<p><strong>Author:</strong> ${authorName}</p>`;
            if (date) {
              noteHTML += `<p><strong>Created:</strong> ${new Date(date).toLocaleDateString()}</p>`;
            }
            if (quotation) {
              noteHTML += `<div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-left: 3px solid #007acc;"><strong>Quoted Text:</strong><br/><em>"${quotation}"</em></div>`;
            }
            if (comment) {
              noteHTML += `<div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border: 1px solid #ddd;"><strong>Comment:</strong><br/>${comment}</div>`;
            }
            
            note.setNote(noteHTML);
            
            // FIXED: Set parent using parentKey, not parentID
            note.parentKey = item.key;
            note.libraryID = item.libraryID;
            
            await note.save();
            
            addedCount++;
            log(`Added note for nanopublication: ${title}`);
            
          } catch (e) {
            error("Failed to add nanopublication:", e);
            this.showError(`Failed to add nanopublication: ${(e as Error).message}`);
          }
        }
      }
      
      this.showSuccess(`Search complete!\nFound: ${results.length} nanopublications\nAdded: ${addedCount} as notes`);
      log(`Search completed with ${results.length} results, ${addedCount} added`);

    } catch (err) {
      error("Failed to search nanopublications:", err);
      this.showError("Search failed: " + (err as Error).message);
    }
  }

  /**
   * FIXED: Create nanopublication from PDF selection
   */
  async createNanopubFromPDFSelection() {
    try {
      log("Creating nanopublication from PDF selection");

      // Get active reader
      const reader = await this.getActiveReader();
      if (!reader) {
        this.showError("Please open a PDF first");
        return;
      }

      // Get selected text
      const selectedText = await this.getSelectedTextFromReader(reader);
      if (!selectedText) {
        this.showError("Please select text in the PDF first");
        return;
      }

      // Get parent item and DOI
      const parentItem = await this.getParentItemFromReader(reader);
      if (!parentItem) {
        this.showError("PDF has no parent item");
        return;
      }

      const doi = parentItem.getField('DOI');
      if (!doi) {
        this.showError("Parent item has no DOI");
        return;
      }

      // Open nanodash with pre-filled data
      await this.openNanodashForSelection(selectedText, parentItem, doi);
      
      log("Nanodash opened for PDF selection");

    } catch (err) {
      error("Failed to create nanopub from PDF selection:", err);
      this.showError("Failed to create nanopublication: " + (err as Error).message);
    }
  }

  // === Private helper methods ===

  private async fetchNanopublication(url: string) {
    log(`Fetching nanopublication from: ${url}`);
    
    const trigUrl = url.replace('https://w3id.org/np/', 'https://np.knowledgepixels.com/') + '.trig';
    const response = await Zotero.HTTP.request('GET', trigUrl);
    
    if (response.status !== 200) {
      throw new Error(`Could not fetch nanopublication (status: ${response.status})`);
    }

    const content = response.responseText;
    
    // Parse basic info from TriG
    return {
      content,
      label: content.match(/rdfs:label\s+"([^"]+)"/)?.[1],
      date: content.match(/dct:created\s+"([^"]+)"/)?.[1],
      doi: content.match(/cito:quotes\s+<https:\/\/doi\.org\/([^>]+)>/)?.[1],
      quotation: content.match(/cito:hasQuotedText\s+"([^"]+)"/)?.[1],
      comment: content.match(/rdfs:comment\s+"([^"]+)"/)?.[1]
    };
  }

  private async executeNanopubSearch(sparqlQuery: string, cleanTerm: string) {
    log("SPARQL Query:", sparqlQuery);

    const encodedQuery = encodeURIComponent(sparqlQuery.trim());
    const endpoint = 'https://query.petapico.org/repo/full';
    
    try {
      const response = await Zotero.HTTP.request('GET', 
        `${endpoint}?query=${encodedQuery}&format=json`, 
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Zotero-Nanopub-Plugin'
          }
        }
      );

      if (response.status !== 200) {
        throw new Error(`Query failed with status: ${response.status}`);
      }

      const data = JSON.parse(response.responseText);
      const results = data.results?.bindings || [];
      
      log(`Search returned ${results.length} results`);
      return results;

    } catch (err) {
      error("SPARQL query failed:", err);
      throw new Error(`Search query failed: ${(err as Error).message}`);
    }
  }

  private async getActiveReader() {
    try {
      // Try to get reader from active tab
      if ((globalThis as any).Zotero_Tabs?.selectedID) {
        const reader = Zotero.Reader.getByTabID((globalThis as any).Zotero_Tabs.selectedID);
        if (reader) {
          log("Found active reader from tab");
          return reader;
        }
      }

      log("No active reader found");
      return null;
    } catch (err) {
      error("Failed to get active reader:", err);
      return null;
    }
  }

  private async getSelectedTextFromReader(reader: any) {
    try {
      // Get selected text from PDF reader
      let selectedText = '';
      
      if (reader._iframeWindow?.wrappedJSObject?.getSelection) {
        const selection = reader._iframeWindow.wrappedJSObject.getSelection();
        selectedText = selection?.toString()?.trim() || '';
      }
      
      log(`Selected text length: ${selectedText.length}`);
      return selectedText;
    } catch (err) {
      error("Failed to get selected text:", err);
      return '';
    }
  }

  private async getParentItemFromReader(reader: any) {
    try {
      const attachment = Zotero.Items.get(reader.itemID);
      const parentItem = attachment?.parentItem;
      
      if (parentItem) {
        log(`Found parent item: ${parentItem.getField('title')}`);
      } else {
        log("No parent item found");
      }
      
      return parentItem;
    } catch (err) {
      error("Failed to get parent item:", err);
      return null;
    }
  }

  private async openNanodashForSelection(selectedText: string, parentItem: any, doi: string) {
    try {
      const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      
      const templateParams = new URLSearchParams({
        template: this.templateUrl,
        'param_quotes-doi': 'https://doi.org/' + cleanDoi,
        'param_quotes-text': selectedText,
        'param_comment': `Selected from: ${parentItem.getField('title')}`
      });

      const nanodashUrl = `https://nanodash.knowledgepixels.com/publish?${templateParams.toString()}`;
      
      log("Opening nanodash URL:", nanodashUrl);
      Zotero.launchURL(nanodashUrl);
      
    } catch (err) {
      error("Failed to open nanodash:", err);
      throw err;
    }
  }

  private showError(message: string) {
    const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    ps.alert(Zotero.getMainWindow(), "Nanopub Plugin Error", message);
  }

  private showSuccess(message: string) {
    const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    ps.alert(Zotero.getMainWindow(), "Nanopub Plugin Success", message);
  }

  cleanup() {
    log("NanopubManager cleanup");
  }
}
