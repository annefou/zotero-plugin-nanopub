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

// Create the main plugin object and expose it globally
const ZoteroNanopubPlugin = {
  addon,
  
  onStartup: async function({
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
      
      log("Nanopub Plugin started successfully");
      log("=================================");
      
    } catch (err) {
      error("Failed to start Nanopub Plugin:", err);
    }
  },

  onShutdown: function() {
    try {
      log("Nanopub Plugin shutting down...");
      
      // Unregister UI elements
      unregisterMenu(addon);
      
      // Cleanup manager
      if (addon.manager) {
        addon.manager.cleanup();
      }
      
      log("Nanopub Plugin shut down");
    } catch (err) {
      error("Failed to shutdown properly:", err);
    }
  }
};

// Make the plugin available globally for bootstrap.js
if (!Zotero.Nanopub) {
  Zotero.Nanopub = {};
}

// Expose both ways for compatibility
Zotero.Nanopub.onStartup = ZoteroNanopubPlugin.onStartup;
Zotero.Nanopub.onShutdown = ZoteroNanopubPlugin.onShutdown;
Zotero.Nanopub.addon = addon;

// Also expose on global object (for esbuild IIFE)
(globalThis as any).ZoteroNanopub = ZoteroNanopubPlugin;

// Export for module access
export { addon, ZoteroNanopubPlugin as default };
