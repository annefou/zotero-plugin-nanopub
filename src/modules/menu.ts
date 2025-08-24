import { getString } from "../utils/locale";
import { log, error } from "../utils/logger";

export async function registerMenu(addon: any) {
  try {
    log("Starting menu registration...");
    
    // Wait for Zotero to be fully ready
    if (!Zotero.getActiveZoteroPane) {
      log("Waiting for ZoteroPane...");
      await Zotero.uiReadyPromise;
    }
    
    // Get the window and document
    const win = Zotero.getMainWindow();
    const doc = win.document;
    
    log("Window and document obtained");
    
    // Find the item context menu
    const zoteroItemMenu = doc.getElementById("zotero-itemmenu");
    if (!zoteroItemMenu) {
      error("Could not find zotero-itemmenu!");
      return;
    }
    
    log("Found zotero-itemmenu");
    
    // Check if menu item already exists
    let existingItem = doc.getElementById("nanopub-create-menuitem");
    if (existingItem) {
      log("Menu item already exists, removing old one");
      existingItem.remove();
    }
    
    // Create separator
    const separator = doc.createXULElement ? 
      doc.createXULElement("menuseparator") : 
      doc.createElement("menuseparator");
    separator.id = "nanopub-separator";
    
    // Create menu item
    const menuitem = doc.createXULElement ? 
      doc.createXULElement("menuitem") : 
      doc.createElement("menuitem");
    
    menuitem.id = "nanopub-create-menuitem";
    menuitem.setAttribute("label", getString("nanopub.menu.create"));
    menuitem.addEventListener("command", async () => {
      log("Menu item clicked!");
      if (addon.manager) {
        await addon.manager.createNanopublicationForSelected();
      } else {
        error("Manager not initialized!");
      }
    });
    
    // Add to menu
    zoteroItemMenu.appendChild(separator);
    zoteroItemMenu.appendChild(menuitem);
    
    log("Menu item added successfully");
    
    // Also add to Tools menu
    const toolsMenu = doc.getElementById("menu_ToolsPopup");
    if (toolsMenu) {
      const toolsItem = doc.createXULElement ? 
        doc.createXULElement("menuitem") : 
        doc.createElement("menuitem");
      
      toolsItem.id = "nanopub-tools-menuitem";
      toolsItem.setAttribute("label", getString("nanopub.menu.tools"));
      toolsItem.addEventListener("command", async () => {
        log("Tools menu item clicked!");
        if (addon.manager) {
          await addon.manager.createNanopublicationForSelected();
        }
      });
      
      toolsMenu.appendChild(toolsItem);
      log("Tools menu item added");
    }
    
  } catch (err) {
    error("Failed to register menu:", err);
  }
}

export function unregisterMenu(addon: any) {
  try {
    log("Unregistering menu items");
    
    const doc = Zotero.getMainWindow().document;
    
    // Remove items
    const menuItem = doc.getElementById("nanopub-create-menuitem");
    const separator = doc.getElementById("nanopub-separator");
    const toolsItem = doc.getElementById("nanopub-tools-menuitem");
    
    if (menuItem) menuItem.remove();
    if (separator) separator.remove();
    if (toolsItem) toolsItem.remove();
    
    log("Menu items removed");
  } catch (err) {
    error("Failed to unregister menu:", err);
  }
}
