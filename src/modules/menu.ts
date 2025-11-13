import { getString } from "../utils/locale";
import { log, error } from "../utils/logger";

export async function registerMenu(addon: any) {
  try {
    log("Starting enhanced menu registration...");
    
    // Wait for Zotero to be fully ready
    if (!Zotero.getActiveZoteroPane) {
      log("Waiting for ZoteroPane...");
      await Zotero.uiReadyPromise;
    }
    
    // Get the window and document
    const win = Zotero.getMainWindow();
    const doc = win.document;
    
    log("Window and document obtained");
    
    // Remove existing items first
    cleanupMenuItems(doc);
    
    // 1. FIXED: Add import to File menu instead of Tools
    await registerFileMenu(doc, addon);
    
    // 2. Add item context menu (search functionality)
    await registerItemContextMenu(doc, addon);
    
    // 3. FIXED: Register PDF reader context menu for text selection
    await registerPDFContextMenu(addon);
    
    // Note: REMOVED SPARQL from Tools menu as requested
    
    log("Enhanced menu registration completed");
    
  } catch (err) {
    error("Failed to register enhanced menu:", err);
  }
}

function cleanupMenuItems(doc: Document) {
  const menuIds = [
    "nanopub-create-menuitem",
    "nanopub-separator", 
    "nanopub-tools-menuitem",
    "nanopub-file-import",
    "nanopub-file-separator",
    "nanopub-item-search",
    "nanopub-item-separator"
  ];
  
  menuIds.forEach(id => {
    const element = doc.getElementById(id);
    if (element) {
      element.remove();
      log(`Removed existing menu item: ${id}`);
    }
  });
}

async function registerFileMenu(doc: Document, addon: any) {
  try {
    log("Registering File menu items...");
    
    const fileMenu = doc.getElementById("menu_FilePopup");
    if (!fileMenu) {
      error("Could not find File menu popup!");
      return;
    }
    
    // Find insertion point (after Import menu if it exists)
    const importMenu = doc.getElementById("menu_import");
    let insertionPoint = importMenu ? importMenu.nextSibling : null;
    
    // Create separator
    const separator = doc.createXULElement ? 
      doc.createXULElement("menuseparator") : 
      doc.createElement("menuseparator");
    separator.id = "nanopub-file-separator";
    
    // Create import menu item
    const importItem = doc.createXULElement ? 
      doc.createXULElement("menuitem") : 
      doc.createElement("menuitem");
    
    importItem.id = "nanopub-file-import";
    importItem.setAttribute("label", "Import Nanopublication by URL...");
    importItem.addEventListener("command", async () => {
      log("File menu import clicked!");
      if (addon.manager) {
        await addon.manager.importNanopublicationByURL();
      } else {
        error("Manager not initialized for import!");
      }
    });
    
    // Insert at appropriate location
    if (insertionPoint) {
      fileMenu.insertBefore(separator, insertionPoint);
      fileMenu.insertBefore(importItem, insertionPoint);
    } else {
      fileMenu.appendChild(separator);
      fileMenu.appendChild(importItem);
    }
    
    log("File menu items registered successfully");
    
  } catch (err) {
    error("Failed to register File menu:", err);
  }
}

async function registerItemContextMenu(doc: Document, addon: any) {
  try {
    log("Registering item context menu...");
    
    const itemMenu = doc.getElementById("zotero-itemmenu");
    if (!itemMenu) {
      error("Could not find item context menu!");
      return;
    }
    
    // Create separator
    const separator = doc.createXULElement ? 
      doc.createXULElement("menuseparator") : 
      doc.createElement("menuseparator");
    separator.id = "nanopub-item-separator";
    
    // Create search menu item
    const searchItem = doc.createXULElement ? 
      doc.createXULElement("menuitem") : 
      doc.createElement("menuitem");
    
    searchItem.id = "nanopub-item-search";
    searchItem.setAttribute("label", "Search Nanopublications for This Item");
    searchItem.addEventListener("command", async () => {
      log("Item context menu search clicked!");
      if (addon.manager) {
        await addon.manager.searchNanopublicationsForSelected();
      } else {
        error("Manager not initialized for search!");
      }
    });
    
    // Add to menu
    itemMenu.appendChild(separator);
    itemMenu.appendChild(searchItem);
    
    log("Item context menu registered successfully");
    
  } catch (err) {
    error("Failed to register item context menu:", err);
  }
}

async function registerPDFContextMenu(addon: any) {
  try {
    log("Registering PDF reader context menu...");
    
    const win = Zotero.getMainWindow();
    
    // FIXED: Monitor for reader tabs and add context menu properly
    const monitorReaderTabs = () => {
      try {
        // Hook into tab selection
        if ((globalThis as any).Zotero_Tabs && (globalThis as any).Zotero_Tabs.deck) {
          const tabDeck = (globalThis as any).Zotero_Tabs.deck;
          
          // Check all existing tabs
          for (let i = 0; i < tabDeck.children.length; i++) {
            const tab = tabDeck.children[i];
            if (tab.id && tab.id.startsWith('reader-')) {
              addPDFContextMenu(tab, addon);
            }
          }
          
          // Monitor for new tabs
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node: any) => {
                if (node.nodeType === Node.ELEMENT_NODE && 
                    node.id && node.id.startsWith('reader-')) {
                  setTimeout(() => addPDFContextMenu(node, addon), 1000);
                }
              });
            });
          });
          
          observer.observe(tabDeck, { childList: true });
          
          // Store observer for cleanup
          if (!addon.pdfObserver) {
            addon.pdfObserver = observer;
          }
        }
        
      } catch (err) {
        log("Error monitoring reader tabs:", err);
      }
    };
    
    // Start monitoring
    monitorReaderTabs();
    
    // Also add keyboard shortcut as backup
    win.document.addEventListener("keydown", (e: KeyboardEvent) => {
      // Ctrl+Shift+N - Create from PDF selection
      if (e.key === 'N' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (addon.manager) {
          addon.manager.createNanopubFromPDFSelection();
        }
      }
    });
    
    log("PDF context menu registration setup completed");
    
  } catch (err) {
    error("Failed to register PDF context menu:", err);
  }
}

function addPDFContextMenu(readerTab: any, addon: any) {
  try {
    if (!readerTab || !readerTab.contentWindow) return;
    
    const readerDoc = readerTab.contentWindow.document;
    if (!readerDoc || readerTab.__nanopubProcessed) return;
    
    log("Adding PDF context menu to reader tab");
    
    // Add right-click listener to the reader document
    const contextMenuHandler = (e: MouseEvent) => {
      // Remove existing context menu if present
      const existingMenu = readerDoc.getElementById('nanopub-context-menu');
      if (existingMenu) {
        existingMenu.remove();
      }
      
      // Check if text is selected
      const selection = readerDoc.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';
      
      if (selectedText) {
        // Create context menu
        const contextMenu = readerDoc.createElement('div');
        contextMenu.id = 'nanopub-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.background = 'white';
        contextMenu.style.border = '1px solid #ccc';
        contextMenu.style.borderRadius = '4px';
        contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        contextMenu.style.padding = '5px 0';
        contextMenu.style.zIndex = '10000';
        contextMenu.style.fontSize = '14px';
        contextMenu.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        contextMenu.style.minWidth = '200px';
        
        const menuItem = readerDoc.createElement('div');
        menuItem.textContent = 'Create Nanopublication from Selection';
        menuItem.style.padding = '8px 16px';
        menuItem.style.cursor = 'pointer';
        menuItem.style.whiteSpace = 'nowrap';
        
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = '#e6f3ff';
        });
        
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
        });
        
        menuItem.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          contextMenu.remove();
          
          log("PDF context menu nanopub item clicked!");
          if (addon.manager) {
            addon.manager.createNanopubFromPDFSelection();
          }
        });
        
        contextMenu.appendChild(menuItem);
        readerDoc.body.appendChild(contextMenu);
        
        // Remove menu when clicking elsewhere
        const removeMenu = (e: MouseEvent) => {
          if (!contextMenu.contains(e.target as Node)) {
            contextMenu.remove();
            readerDoc.removeEventListener('click', removeMenu);
          }
        };
        
        setTimeout(() => {
          readerDoc.addEventListener('click', removeMenu);
        }, 100);
        
        // Prevent default context menu
        e.preventDefault();
        
        log("PDF context menu created and displayed");
      }
    };
    
    readerDoc.addEventListener('contextmenu', contextMenuHandler);
    readerTab.__nanopubProcessed = true;
    
    log("PDF context menu handler added to reader tab");
    
  } catch (err) {
    error("Error adding PDF context menu:", err);
  }
}

export function unregisterMenu(addon: any) {
  try {
    log("Unregistering menu items");
    
    const doc = Zotero.getMainWindow().document;
    
    // Remove all menu items
    const menuIds = [
      "nanopub-create-menuitem",
      "nanopub-separator", 
      "nanopub-tools-menuitem",
      "nanopub-file-import",
      "nanopub-file-separator",
      "nanopub-item-search",
      "nanopub-item-separator"
    ];
    
    menuIds.forEach(id => {
      const element = doc.getElementById(id);
      if (element) {
        element.remove();
        log(`Removed menu item: ${id}`);
      }
    });
    
    // Clean up PDF observer
    if (addon.pdfObserver) {
      addon.pdfObserver.disconnect();
      addon.pdfObserver = null;
      log("Disconnected PDF mutation observer");
    }
    
    log("Menu items and cleanup completed");
    
  } catch (err) {
    error("Failed to unregister menu:", err);
  }
}
