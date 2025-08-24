import { getString } from "../utils/locale";
import { log, error } from "../utils/logger";

export interface NanopubMetadata {
  title: string;
  authors: string;
  date: string;
  doi: string;
  url: string;
  abstract: string;
  itemKey: string;
  libraryID: number;
}

export class NanopubManager {
  private addon: any;
  private nanodashUrl = "https://nanodash.knowledgepixels.com/";
  private queryUrl = "https://query.petapico.org/tools/full/yasgui.html";
  
  constructor(addon: any) {
    this.addon = addon;
  }
  
  async initialize() {
    log("Initializing Nanopub Manager");
    
    // Register Zotero notifier to watch for item changes
    Zotero.Notifier.registerObserver(this, ["item"], "nanopub");
  }
  
  async cleanup() {
    log("Cleaning up Nanopub Manager");
    Zotero.Notifier.unregisterObserver("nanopub");
  }
  
  /**
   * Create a nanopublication for selected items
   */
  async createNanopublicationForSelected() {
    const items = this.getSelectedItems();
    
    if (items.length === 0) {
      this.showAlert(
        getString("nanopub.error.noItem"),
        getString("nanopub.error.title")
      );
      return;
    }
    
    for (const item of items) {
      await this.createNanopublication(item);
    }
  }
  
  /**
   * Create a nanopublication for a single item
   */
  async createNanopublication(item: Zotero.Item) {
    try {
      log(`Creating nanopublication for item ${item.key}`);
      
      // Extract metadata
      const metadata = await this.extractMetadata(item);
      
      // Open Nanodash with metadata
      const url = this.buildNanodashUrl(metadata);
      Zotero.launchURL(url);
      
      // Wait for user to create nanopublication and get URL
      const nanopubUrl = await this.promptForNanopubUrl();
      
      if (nanopubUrl) {
        // Validate URL
        if (!this.isValidUrl(nanopubUrl)) {
          this.showAlert(
            getString("nanopub.error.invalidUrl"),
            getString("nanopub.error.title")
          );
          return;
        }
        
        // Link nanopublication to item
        await this.linkNanopublication(item, nanopubUrl);
        
        this.showAlert(
          getString("nanopub.success"),
          getString("nanopub.success.title")
        );
      }
    } catch (err) {
      error("Failed to create nanopublication", err);
      this.showAlert(
        getString("nanopub.error.general") + ": " + err.message,
        getString("nanopub.error.title")
      );
    }
  }
  
  /**
   * Extract metadata from a Zotero item
   */
  async extractMetadata(item: Zotero.Item): Promise<NanopubMetadata> {
    const creators = item.getCreators();
    const authors = creators
      .map((c) => `${c.firstName} ${c.lastName}`.trim())
      .join(", ");
    
    return {
      title: item.getField("title") as string || "",
      authors: authors,
      date: item.getField("date") as string || "",
      doi: item.getField("DOI") as string || "",
      url: item.getField("url") as string || "",
      abstract: item.getField("abstractNote") as string || "",
      itemKey: item.key,
      libraryID: item.libraryID,
    };
  }
  
  /**
   * Build Nanodash URL with metadata parameters
   */
  private buildNanodashUrl(metadata: NanopubMetadata): string {
    // For now, just return base URL
    // Could be enhanced to pass metadata as URL parameters
    return this.nanodashUrl;
  }
  
  /**
   * Prompt user for nanopublication URL
   */
  private async promptForNanopubUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      // Use setTimeout to allow Nanodash to open first
      setTimeout(() => {
        const ps = Services.prompt;
        const input = { value: "" };
        const result = ps.prompt(
          null,
          getString("nanopub.prompt.title"),
          getString("nanopub.prompt.text"),
          input,
          null,
          { value: false }
        );
        
        if (result && input.value) {
          resolve(input.value.trim());
        } else {
          resolve(null);
        }
      }, 3000);
    });
  }
  
  /**
   * Link nanopublication URL to Zotero item
   */
  async linkNanopublication(item: Zotero.Item, url: string) {
    log(`Linking nanopublication ${url} to item ${item.key}`);
    
    // Option 1: Add as web link attachment
    await Zotero.Attachments.linkFromURL({
      url: url,
      parentItemID: item.id,
      title: "Nanopublication: " + url.split("/").pop(),
    });
    
    // Option 2: Also store in Extra field for easy access
    let extra = item.getField("extra") as string || "";
    if (extra) extra += "\n";
    extra += `Nanopublication: ${url}`;
    item.setField("extra", extra);
    await item.saveTx();
  }
  
  /**
   * Search nanopublications using SPARQL
   */
  async searchNanopublications(query: string) {
    // Open query interface with the query
    const url = `${this.queryUrl}#query=${encodeURIComponent(query)}`;
    Zotero.launchURL(url);
  }
  
  /**
   * Get selected items from Zotero pane
   */
  private getSelectedItems(): Zotero.Item[] {
    const zoteroPane = Zotero.getActiveZoteroPane();
    return zoteroPane?.getSelectedItems() || [];
  }
  
  /**
   * Validate URL format
   */
  private isValidUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }
  
  /**
   * Show alert dialog
   */
  private showAlert(message: string, title: string) {
    const ps = Services.prompt;
    ps.alert(null, title, message);
  }
  
  /**
   * Handle Zotero item notifications
   */
  notify(
    event: string,
    type: string,
    ids: number[] | string[],
    extraData: any
  ) {
    // Can be used to auto-create nanopublications on item creation
    if (event === "add" && type === "item") {
      log(`New items added: ${ids.join(", ")}`);
      // Could auto-prompt for nanopublication creation
    }
  }
}
