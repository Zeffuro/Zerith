TODO: Have a build process (not documentation, something  that actually does it.) that compiles the game. Not sure yet if using Tauri or something else. Would be nice if it "just works" (desktop, mobile, itch.io).    
TODO: Show .sheet files as a child of the sprite/audio sheet in the explorer, and open them in the appropriate editor when clicked, the json should also have a json editor.  
TODO: Remove old sprite sheet editor and audio sheet editor (the ones next to the inspector etc).  
TODO: Modernize audiosheet editor with better buttons that fit the design, allow dragging the cue start/end points on the waveform instead of shift-clicking. And be able to drag to scrub the audio.  
TODO: Have a way to do manual spritesheet slicing (click and drag to create a new sprite, or click to set slice points). And be able to drag the slice points to adjust them.  
TODO: Autosave interval should be a int input, not a dropdown.  
TODO: Find a better name for the theme accents to know what users are changing (e.g. "blue" is not very descriptive, but "primary accent color" is). Maybe we can add a comment in the code to explain what each accent is used for, and use that as the label in the UI.  
TODO: Improve the theme editor, maybe use small cards or have some kind of grid layout to show the variables in a more organized way. And maybe add a live preview of the theme as you edit it.
TODO: Don't use native dialogs for confirmation, use the app's modal system so it looks consistent.
TODO: Delete button in the timeline editor does nothing atm.