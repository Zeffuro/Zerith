TODO: Enhance commandpalette (stuff like export game etc.)  
TODO: Keeping an eye on the project folder/subfolder, need to know when files are added/removed (through Rust for speed?) Folder Watchdog?    
TODO: Find out what the difference is between .sheet.json and .atlas.json and if they can be unified (if compatibility needs to break, do so anyway)  
TODO: A way to edit docked panel layouts and save them.  
TODO: Link to GitHub not opening.  
TODO: Call Inspector not working: %s Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops. The above error occurred in the <CallInspector> component. React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.  
TODO: Add multiple settings to also independently size other components / ignore UI scale option.  
TODO: Add a "New Project" option to the file menu.  
TODO: Add a "Save Project As..." option to the file menu.  
TODO: Possibly add git integration? Is there any library for this, maybe through Rust? Some minimal GUI for commits, branches, and diffs would be amazing.  
TODO: Investigate how font/sprite/size/position work for different screen sizes. Currently the font and and sprites overflow.  
TODO: Investigate other game export options, like desktop builds through Tauri or other options that make sense.  
TODO: Enhance Project Settings metadata like author etc.  
TODO: Add a way to manage assets in the project, like adding/removing assets, organizing them in folders, etc.
TODO: Some way to keep track of what assets/scenes are used in the game and which ones are not, maybe through a dependency graph or something similar as well as a check when trying to delete an asset that is still being used in a scene.  
TODO: Quickbuttons modal should probably also live in settings.  
TODO: Check if audiosheet sprites are already properly used in core and if not, add support for them.  
TODO: Allow parts of audiosheet editor to be used for non-audiosheets as well (waveform display, region selection, etc, allow exporting a region as a separate audio file, etc.)  
TODO: Spritesheet editor is very ugly with the buttons not using our themes.  
TODO: When scroll zooming in the spritesheet editor it's scrolling the page as well, need to prevent that, probably have similar setting like the audiosheet editor for targetting the zoom to curser position instead of center.  
TODO: More schema stuff since I see engineConfig has their own suddenly? Unify I guess?  