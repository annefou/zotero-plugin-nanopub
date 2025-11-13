/* Bootstrap for Zotero Nanopub Plugin - Corrected TypeScript Approach */

var Zotero;
var Services;

function install(data, reason) {}
function uninstall(data, reason) {}

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec } = {}, reason) {
  // Get Zotero context first
  if (!Zotero) {
    Zotero = Components.classes["@zotero.org/Zotero;1"]
      .getService(Components.interfaces.nsISupports)
      .wrappedJSObject;
  }
  
  if (!Services) {
    Services = globalThis.Services;
  }
  
  // Wait for Zotero to be ready
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;
  
  try {
    // Import the built TypeScript code
    Services.scriptloader.loadSubScript(`${rootURI}content/scripts/index.js`);
    
    // Call the TypeScript startup function if it exists
    if (globalThis.ZoteroNanopub && globalThis.ZoteroNanopub.onStartup) {
      await globalThis.ZoteroNanopub.onStartup({ id, version, rootURI });
    } else if (Zotero.Nanopub && Zotero.Nanopub.onStartup) {
      await Zotero.Nanopub.onStartup({ id, version, rootURI });
    } else {
      Zotero.logError("Nanopub Plugin: TypeScript startup function not found");
    }
  } catch (e) {
    Zotero.logError("Nanopub Plugin startup failed:", e);
  }
}

function shutdown({ id, version, resourceURI, rootURI = resourceURI.spec } = {}, reason) {
  if (reason === APP_SHUTDOWN) return;
  
  try {
    // Call the TypeScript shutdown function if it exists
    if (globalThis.ZoteroNanopub && globalThis.ZoteroNanopub.onShutdown) {
      globalThis.ZoteroNanopub.onShutdown();
    } else if (Zotero.Nanopub && Zotero.Nanopub.onShutdown) {
      Zotero.Nanopub.onShutdown();
    }
  } catch (e) {
    Zotero.logError("Nanopub Plugin shutdown failed:", e);
  }
}
