import { config } from "../package.json";
import { NanopubManager } from "./modules/nanopubManager";
import { registerMenu, unregisterMenu } from "./modules/menu";
import { getString, initLocale } from "./utils/locale";
import { log, error } from "./utils/logger";

// Create the addon object
const addon = {
  id: config.addonID,
  name: config.addonName,
  rootURI: "",
  manager: null as NanopubManager | null,
};

// Make functions available globally for bootstrap.js
if (!Zotero.Nanopub) {
  Zotero.Nanopub = {};
}

Zotero.Nanopub.onStartup = async function({
  id,
  version,
  rootURI,
}: {
  id: string;
  version: string;
  rootURI: string;
}) {
  try {
    log("=================================");
    log("Nanopub Plugin starting...");
    log(`Version: ${version}`);
    log(`Root URI: ${rootURI}`);
    
    addon.rootURI = rootURI;
    
    // Wait for Zotero to be ready
    await Zotero.uiReadyPromise;
    log("Zotero UI is ready");
    
    // Initialize localization
    await initLocale();
    log("Locale initialized");
    
    // Initialize the manager
    addon.manager = new NanopubManager(addon);
    await addon.manager.initialize();
    log("Manager initialized");
    
    // Register UI elements with a small delay to ensure everything is ready
    setTimeout(async () => {
      await registerMenu(addon);
      log("Menu registered");
    }, 1000);
    
    // Store addon in Zotero global for access
    Zotero.Nanopub.addon = addon;
    
    log("Nanopub Plugin started successfully");
    log("=================================");
    
    // Test: Log when right-clicking items
    const originalShowItem = Zotero.getActiveZoteroPane().onShowItem;
    Zotero.getActiveZoteroPane().onShowItem = function(event: any) {
      log("Context menu opened on items");
      if (originalShowItem) {
        originalShowItem.call(this, event);
      }
    };
    
  } catch (err) {
    error("Failed to start Nanopub Plugin:", err);
  }
};

Zotero.Nanopub.onShutdown = function() {
  try {
    log("Nanopub Plugin shutting down...");
    
    // Unregister UI elements
    unregisterMenu(addon);
    
    // Cleanup manager
    if (addon.manager) {
      addon.manager.cleanup();
    }
    
    // Remove from Zotero global
    delete Zotero.Nanopub.addon;
    
    log("Nanopub Plugin shut down");
  } catch (err) {
    error("Failed to shutdown properly:", err);
  }
};

// Export for module access
export { addon };
