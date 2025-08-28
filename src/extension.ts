import './styles/stylesheet.scss';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import { getDateTime } from '@utils/dateutil';

const DYNAMIC_ISLAND_STATES = {
  COMPACT: 'compact',
  EXPANDED: 'expanded',
  NOTIFICATION: 'notification',
  MUSIC: 'music',
};

const PLAYERCTL_METADATA_CMD =
  'playerctl metadata --format \'{\
                                    "artist":"{{artist}}",\
                                    "album":"{{album}}",\
                                    "title":"{{title}}",\
                                    "status":"{{status}}",\
                                    "current":"{{duration(position)}}",\
                                    "total":"{{duration(mpris:length)}}",\
                                    "artUrl":"{{mpris:artUrl}}"\
                                    }\'';

type MusicMetadata = {
  artist: string;
  album: string;
  title: string;
  status: string;
  current: string;
  total: string;
  artUrl: string;
};

export default class DynIslandExtension extends Extension {
  private dynamicIsland: St.Bin | null;
  private islandContainer: St.BoxLayout | null;
  private compactContent: St.BoxLayout | null;
  private expandedContent: St.BoxLayout | null;
  private currentState: string;
  private isExpanded: boolean;
  private musicPollId: number | null;
  private datetimePollId: number | null;
  private statusIcon: St.Icon | null;
  private statusText: St.Label | null;
  private musicMetadata: MusicMetadata | null;
  private musicSection: St.BoxLayout | null;
  private albumArt: St.Icon | null;
  private isPlaying: boolean;
  private musicPosition: number | null;
  private trackInfo: St.BoxLayout | null;
  private trackTitle: St.Label | null;
  private trackArtist: St.Label | null;
  private musicControls: St.BoxLayout | null;
  private prevButton: St.Button | null;
  private nextButton: St.Button | null;
  private playPauseButton: St.Button | null;

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
    this.dynamicIsland = null;
    this.islandContainer = null;
    this.compactContent = null;
    this.expandedContent = null;
    this.currentState = DYNAMIC_ISLAND_STATES.COMPACT;
    this.isExpanded = false;
    this.musicPollId = null;
    this.datetimePollId = null;
    this.statusIcon = null;
    this.statusText = null;
    this.musicMetadata = null;
    this.musicSection = null;
    this.albumArt = null;
    this.isPlaying = false;
    this.musicPosition = null;
    this.trackInfo = null;
    this.trackTitle = null;
    this.trackArtist = null;
    this.prevButton = null;
    this.nextButton = null;
    this.playPauseButton = null;
    this.musicControls = null;
  }

  enable() {
    log('Dynamic Island: Extension enabling...');
    this._createDynamicIsland();
    // this._setupNotificationListener();
    this._setupMusicListener();
    this._addToPanel();
    log('Dynamic Island: Extension enabled successfully sWW');
  }

  disable() {
    if (this.dynamicIsland) {
      (
        Main.panel as unknown as {
          _centerBox: { remove_child: (child: St.Widget) => void };
        }
      )._centerBox.remove_child(this.dynamicIsland);
      this.dynamicIsland.destroy();
      this.dynamicIsland = null;
    }
    this._cleanupListeners();
  }

  _createDynamicIsland() {
    // Main container
    this.dynamicIsland = new St.Bin({
      style_class: 'dynamic-island',
      reactive: true,
      can_focus: true,
      track_hover: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    // Island container that changes size
    this.islandContainer = new St.BoxLayout({
      style_class: 'island-container',
      vertical: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this.dynamicIsland.set_child(this.islandContainer);

    // Create compact content (default state)
    this._createCompactContent();

    // Create expanded content (hidden by default)
    this._createExpandedContent();

    // Set initial state to compact
    this._showCompactContent();

    // Setup click handlers
    this.dynamicIsland.connect('button-press-event', () => {
      this._toggleExpansion();
      return Clutter.EVENT_STOP;
    });

    this.dynamicIsland.connect('enter-event', () => {
      if (this.dynamicIsland) this.dynamicIsland.add_style_pseudo_class('hover');
    });

    this.dynamicIsland.connect('leave-event', () => {
      if (this.dynamicIsland) this.dynamicIsland.remove_style_pseudo_class('hover');
    });
    global.stage.add_child(this.dynamicIsland);
    // get x center position
    const primaryMonitor = Main.layoutManager.primaryMonitor;
    if (primaryMonitor) {
      const x = primaryMonitor.x + (primaryMonitor.width / 2) - (this.dynamicIsland.width / 2);
      this.dynamicIsland.set_position(x, 0);
    }
  }

  _createCompactContent() {
    this.compactContent = new St.BoxLayout({
      style_class: 'compact-content',
      vertical: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      visible: true,
    });

    // Status indicator - always visible with fallback
    this.statusIcon = new St.Icon({
      icon_name: 'audio-headphones',
      style_class: 'status-icon',
      icon_size: 8,
    });

    // Add a text label as fallback
    this.statusText = new St.Label({
      text: 'Dynamic Island',
      style_class: 'status-text',
    });
    this._pollDateTimeStatus();

    // this.compactContent.add_child(this.statusIcon);
    this.compactContent.add_child(this.statusText);
    if (this.islandContainer) this.islandContainer.add_child(this.compactContent);

    log('Dynamic Island: Compact content created');
  }

  _createExpandedContent() {
    this.expandedContent = new St.BoxLayout({
      style_class: 'expanded-content',
      vertical: false,
      visible: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    // Music controls section
    this.musicSection = new St.BoxLayout({
      // style_class: 'music-section',
      vertical: false,
    });

    // Album art placeholder
    this.albumArt = new St.Icon({
      icon_name: 'multimedia-player',
      style_class: 'album-art',
      icon_size: 32,
    });

    // Track info
    this.trackInfo = new St.BoxLayout({
      style_class: 'track-info',
      vertical: true,
    });

    this.trackTitle = new St.Label({
      text: 'No Music Playing',
      style_class: 'track-title',
    });

    this.trackArtist = new St.Label({
      text: 's',
      style_class: 'track-artist',
    });

    this.trackInfo.add_child(this.trackTitle);
    this.trackInfo.add_child(this.trackArtist);

    // Control buttons
    this.musicControls = new St.BoxLayout({
      style_class: 'music-controls',
      vertical: false,
    });

    this.prevButton = new St.Button({
      style_class: 'control-button',
      child: new St.Icon({
        icon_name: 'media-skip-backward',
        icon_size: 16,
      }),
    });

    this.playPauseButton = new St.Button({
      style_class: 'control-button play-pause',
      child: new St.Icon({
        icon_name: 'media-playback-start',
        icon_size: 16,
      }),
    });

    this.nextButton = new St.Button({
      style_class: 'control-button',
      child: new St.Icon({
        icon_name: 'media-skip-forward',
        icon_size: 16,
      }),
    });

    // Connect control buttons
    this.prevButton.connect('clicked', () => this._previousTrack());
    this.playPauseButton.connect('clicked', () => this._togglePlayPause());
    this.nextButton.connect('clicked', () => this._nextTrack());

    this.musicControls.add_child(this.prevButton);
    this.musicControls.add_child(this.playPauseButton);
    this.musicControls.add_child(this.nextButton);

    this.musicSection.add_child(this.albumArt);
    this.musicSection.add_child(this.trackInfo);
    this.musicSection.add_child(this.musicControls);

    // Notifications section
    // this.notificationSection = new St.BoxLayout({
    //     // style_class: 'notification-section',
    //     vertical: false,
    //     visible: false,
    // });

    // this.notificationIcon = new St.Icon({
    //     icon_name: 'dialog-information',
    //     style_class: 'notification-icon',
    //     icon_size: 24,
    // });

    // this.notificationText = new St.Label({
    //     text: 'New Notification',
    //     style_class: 'notification-text',
    // });

    // this.notificationSection.add_child(this.notificationIcon);
    // this.notificationSection.add_child(this.notificationText);

    this.expandedContent.add_child(this.musicSection);
    // this.expandedContent.add_child(this.notificationSection);

    // Add expanded content to the island container (hidden by default)
    if (this.islandContainer) this.islandContainer.add_child(this.expandedContent);
  }

  // _setupNotificationListener() {
  //     // Start Rust backend for notification counting
  //     this._startRustBackend();

  //     // Poll notification count from Rust backend
  //     this._pollNotificationCount();
  // }

  _setupMusicListener() {
    // Use Rust backend for music data (no longer need playerctl directly)
    this._pollMusicStatus();
  }

  _setupPlayerctl() {
    // Check if playerctl is available
    try {
      const [success, _stdout, _stderr] = GLib.spawn_command_line_sync('which playerctl');
      if (!success) {
        log('Dynamic Island: playerctl not found. Please install playerctl for music controls.');
        return;
      }
      log('Dynamic Island: playerctl found, music controls enabled');
    } catch (e) {
      log(`Dynamic Island: Error checking for playerctl: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  _pollMusicStatus() {
    this.musicPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._updateMusicFromBackend();
      return GLib.SOURCE_CONTINUE;
    });
  }

  _updateMusicFromBackend() {
    try {
      // Read music status from Rust backend JSON file
      const [status, statusOut] = GLib.spawn_command_line_sync(PLAYERCTL_METADATA_CMD);
      if (!status) {
        log('Dynamic Island: Error reading music status from backend');
        return;
      }
      if (!statusOut || statusOut.length === 0) {
        log('Dynamic Island: No music data received from backend');
        return;
      }
      const musicFile = new TextDecoder().decode(statusOut).trim();
      const musicData = JSON.parse(musicFile);
      this._updateMusicDisplay(musicData);
    } catch (e) {
      log(`Dynamic Island: Error reading music status: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  _updateMusicDisplay(musicData: MusicMetadata) {
    if (musicData.status === 'playing' || musicData.title !== 'No Music Playing') {
      // Update track info
      const title = (musicData.title || 'Unknown Track').substring(0, 20);
      const artist = (musicData.artist || 'Unknown Artist').substring(0, 20);
      if (this.trackTitle && this.trackArtist) {
        this.trackTitle.set_text(title);
        this.trackArtist.set_text(artist);
      }
      // Update album art if available
      if (musicData.artUrl) if (this.albumArt) this.albumArt.gicon = Gio.icon_new_for_string(musicData.artUrl);

      // Update play/pause button
      if (this.playPauseButton && this.playPauseButton.child) {
        const icon = this.playPauseButton.child as St.Icon;
        icon.icon_name = musicData.status === 'playing' ? 'media-playback-pause' : 'media-playback-start';
      }
      // this.playPauseButton.child.icon_name = musicData.playing ?
      //     'media-playback-pause' : 'media-playback-start';

      // Show music controls when playing
      if (musicData.status === 'playing') {
        const icon = this.statusIcon as St.Icon;
        icon.icon_name = 'audio-headphones';
        this._animateToState(DYNAMIC_ISLAND_STATES.MUSIC);
      }

      log(
        `Dynamic Island: Music - ${title} by ${artist} (${musicData.status === 'playing' ? 'Playing' : 'Paused'})`,
      );
    } else if (this.trackTitle && this.trackArtist) {
      // No music playing
      this.trackTitle.set_text('No Music Playing');
      this.trackArtist.set_text('');
    }
  }


  _pollDateTimeStatus() {
    this.datetimePollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._updateDateTime();
      return GLib.SOURCE_CONTINUE;
    });
  }

  _updateDateTime() {
    try {
      const dateTime = getDateTime();
      if (this.statusText) {
        this.statusText.text = dateTime;
      }
    } catch (e) {
      log(`Dynamic Island: Error updating date and time: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // _showNotification(notification) {
  //     const title = notification.title || 'Notification';
  //     const body = notification.bannerBodyText || '';

  //     this.notificationText.set_text(`${title}: ${body}`);
  //     this.notificationIcon.icon_name = notification.gicon ?
  //         notification.gicon.to_string() : 'dialog-information-symbolic';

  //     this._animateToState(DYNAMIC_ISLAND_STATES.NOTIFICATION);

  //     // Auto-hide notification after 3 seconds
  //     GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
  //         this._animateToState(DYNAMIC_ISLAND_STATES.COMPACT);
  //         return GLib.SOURCE_REMOVE;
  //     });
  // }

  _toggleExpansion() {
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) this._showExpandedContent();
    else this._showCompactContent();
  }

  _showCompactContent() {
    if (this.compactContent) this.compactContent.visible = true;

    if (this.expandedContent) this.expandedContent.visible = false;

    if (this.dynamicIsland) {
      this.dynamicIsland.remove_style_class_name('expanded');
      this.dynamicIsland.add_style_class_name('compact');
    }
  }

  _showExpandedContent() {
    if (this.compactContent) this.compactContent.visible = false;

    if (this.expandedContent) this.expandedContent.visible = true;

    if (this.dynamicIsland) {
      this.dynamicIsland.remove_style_class_name('compact');
      this.dynamicIsland.add_style_class_name('expanded');
    }
  }

  _animateToState(state: string) {
    this.currentState = state;

    switch (state) {
      case DYNAMIC_ISLAND_STATES.NOTIFICATION:
        if (this.musicSection) this.musicSection.visible = false;

        // this.notificationSection.visible = true;
        this._showExpandedContent();
        break;
      case DYNAMIC_ISLAND_STATES.MUSIC:
        // this.notificationSection.visible = false;
        if (this.musicSection) this.musicSection.visible = true;

        this._showExpandedContent();
        break;
      case DYNAMIC_ISLAND_STATES.COMPACT:
      default:
        this._showCompactContent();
        break;
    }
  }

  _togglePlayPause() {
    try {
      GLib.spawn_command_line_async('playerctl play-pause');
    } catch (e) {
      log(`Dynamic Island: Error toggling play/pause: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  _previousTrack() {
    try {
      GLib.spawn_command_line_async('playerctl previous');
    } catch (e) {
      log(`Dynamic Island: Error going to previous track: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  _nextTrack() {
    try {
      GLib.spawn_command_line_async('playerctl next');
    } catch (e) {
      log(`Dynamic Island: Error going to next track: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  _addToPanel() {
    log('Dynamic Island: Adding to panel...');
    if (this.dynamicIsland) {
      (
        Main.panel as unknown as {
          _centerBox: {
            insert_child_at_index: (child: St.Widget, index: number) => void;
          };
        }
      )._centerBox.insert_child_at_index(this.dynamicIsland, 0);
      log('Dynamic Island: Successfully added to panel');
    } else {
      log('Dynamic Island: Error - dynamicIsland is null');
    }
  }

  _cleanupListeners() {
    if (this.musicPollId) {
      GLib.source_remove(this.musicPollId);
      this.musicPollId = null;
    }
    if (this.datetimePollId) {
      GLib.source_remove(this.datetimePollId);
      this.datetimePollId = null;
    }
  }
}
