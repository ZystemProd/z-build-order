export default function HomePage() {
  // TODO: Replace placeholder handlers with real implementations using React state and Firebase hooks.
  const handlePlaceholder = () => {
    // TODO: Implement event handler.
  };

  return (
    <main>
      <div id="top-logo-container">
        <img src="img/toplogo.webp" alt="Z-Build Order Logo" className="top-logo" />
      </div>
      <div id="toast-container"></div>

      <div id="game-select">
        <div className="selected-game">
          <img src="img/game-icons/sc2.png" alt="StarCraft 2" />
        </div>
        <div className="game-dropdown">
          <div className="game-option active">
            <img src="img/game-icons/sc2.png" alt="StarCraft 2" />
            <span>StarCraft 2</span>
          </div>
          <div className="game-option disabled">
            <img src="img/game-icons/sg.png" alt="Stormgate" />
            <span>Stormgate (Coming Soon)</span>
          </div>
        </div>
      </div>

      <header id="main-header">
        <nav id="main-nav"></nav>
      </header>

      {/* TODO: Wire up Firebase auth state and menu interactions via hooks. */}
      <div id="auth-container">
        <div className="auth-info">
          <div id="authLoadingWrapper">
            <div id="authLoading" className="spinner"></div>
            <span id="authLoadingText">Loading user...</span>
          </div>

          <div className="user-details">
            <p id="userName" className="user-name fade-in">
              Guest
            </p>
          </div>

          <img id="userPhoto" className="user-avatar fade-in" src="img/default-avatar.webp" alt="User Avatar" />

          <div id="userMenu" className="user-menu">
            <div className="menu-section">
              <p id="userNameMenu" className="user-name fade-in">
                Guest
              </p>
              <hr id="userNameDivider" className="menu-divider" />
              <button className="menu-item" id="mapVetoBtn" onClick={handlePlaceholder}>
                <img src="img/SVG/map-solid.svg" className="menu-icon" alt="Map Veto" /> Map Veto
              </button>
              <hr className="menu-divider" />
              <button className="menu-item" id="showClanModalButton" onClick={handlePlaceholder}>
                <img src="img/SVG/clan.svg" className="menu-icon" alt="Clans" /> Clans
              </button>
              <hr className="menu-divider" />
              <button id="showStatsButton" className="user-menu-button" onClick={handlePlaceholder}>
                <img src="img/SVG/stats.svg" className="menu-icon" alt="My Stats" />My Stats
              </button>
              <hr className="menu-divider" />
              <button className="menu-item" id="settingsBtn" onClick={handlePlaceholder}>
                <img src="img/SVG/settings.svg" className="menu-icon" alt="Settings" /> Settings
              </button>
              <hr className="menu-divider" />
              <button className="menu-item" id="switchAccountBtn" onClick={handlePlaceholder}>
                <img src="img/SVG/switch.svg" className="menu-icon" alt="Switch Account" /> Switch Account
              </button>
              <button className="menu-item" id="signOutBtn" onClick={handlePlaceholder}>
                <img src="img/SVG/logout.svg" className="menu-icon" alt="Sign Out" /> Sign Out
              </button>
              <hr className="menu-divider" />
              <button className="menu-item danger" id="deleteAccountBtn" onClick={handlePlaceholder}>
                <img src="img/SVG/trash.svg" className="menu-icon" alt="Delete Account" /> Delete Account
              </button>
            </div>
          </div>
        </div>

        <button id="signInBtn" className="auth-button" onClick={handlePlaceholder}>
          Sign In
        </button>
      </div>

      <div id="usernameModal" className="modal">
        <div className="modal-content" id="usernameModalContent">
          <span id="closeUsernameModal">&times;</span>
          <h3>Choose a Username</h3>
          <div className="username-input-wrapper">
            <input type="text" id="usernameInput" placeholder="Enter your username" />
            <div id="usernameSpinner" className="spinner-small"></div>
          </div>
          <br />
          <br />
          <button id="confirmUsernameButton" onClick={handlePlaceholder}>
            Confirm
          </button>
        </div>
      </div>

      <div id="content">
        <div className="upperInput">
          <div id="buildOrderHelpModal" className="modal">
            <div className="modal-content">
              <span className="close-modal" id="closeBuildOrderHelpModal">
                &times;
              </span>
              <h3>Build Order Input Help</h3>
              <div id="buildOrderHelpContent"></div>
            </div>
          </div>

          <div className="toggle-header">
            <div className="toggle-header-left">
              <div className="dropdown">
                <div className="template-buttons">
                  <button
                    id="templateMenuButton"
                    className="template-btn"
                    data-tooltip="Template"
                    onClick={handlePlaceholder}
                  >
                    <img src="img/SVG/template.svg" alt="Template" className="svg-icon" />
                  </button>
                  <button
                    id="replayButton"
                    className="template-btn"
                    data-tooltip="Replay"
                    onClick={handlePlaceholder}
                  >
                    <img src="img/SVG/upload.svg" alt="Upload" className="svg-icon" />
                  </button>
                  <button
                    id="reparseLastReplayButton"
                    className="template-btn"
                    style={{ display: "none" }}
                    onClick={handlePlaceholder}
                  >
                    Reparse Last Replay
                  </button>
                </div>
                <div id="templateDropdown" className="dropdown-content">
                  <button id="openTemplatesButton" onClick={handlePlaceholder}>
                    Open Templates
                  </button>
                  <button id="saveTemplateButton" onClick={handlePlaceholder}>
                    Save Template
                  </button>
                </div>
              </div>
            </div>
            <div id="editModeBanner" data-tooltip="Edit Mode"></div>
            <div id="box">
              <div className="cat">
                <div className="cat-tip-bubble" id="catTipBubble">
                  <span id="catTipBubbleText">Tip: Write supply inside [brackets] and the action after</span>
                </div>
                <div className="cat-sleep-indicator" id="catSleepZzz">
                  Zzz...
                </div>
                <div className="head">
                  <div className="ears">
                    <div className="ear left"></div>
                    <div className="ear right"></div>
                  </div>
                  <div className="eyes">
                    <div className="eye left"></div>
                    <div className="eye right"></div>
                  </div>
                  <div className="muzzle">
                    <div className="nose"></div>
                  </div>
                </div>
                <div className="body">
                  <div className="paw"></div>
                </div>
                <div className="tail">
                  <div className="tail-segment">
                    <div className="tail-segment">
                      <div className="tail-segment">
                        <div className="tail-segment">
                          <div className="tail-segment">
                            <div className="tail-segment">
                              <div className="tail-segment">
                                <div className="tail-segment">
                                  <div className="tail-segment">
                                    <div className="tail-segment">
                                      <div className="tail-segment">
                                        <div className="tail-segment">
                                          <div className="tail-segment"></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="toggle-header-right">
              <button id="showBuildsButton" disabled onClick={handlePlaceholder}>
                <img src="img/SVG/library.svg" alt="Library Icon" className="svg-icon" />
                <span className="btn-text">My Builds</span>
              </button>
              <button id="showCommunityModalButton" className="btn" disabled onClick={handlePlaceholder}>
                <img src="img/SVG/community.svg" alt="Community Icon" className="svg-icon" />
                <span className="btn-text">Community Builds</span>
              </button>
              <button id="buildOrderHelpBtn" className="help-circle animated-help" data-tooltip="Help" onClick={handlePlaceholder}>
                ?
              </button>
            </div>
          </div>
          <div id="buildOrderInputField" className="hideable-section">
            <div className="template-wrapper">
              <textarea id="buildOrderInput" placeholder="Spawning Pool"></textarea>
              <div id="optionsLoadingWrapper">
                <div className="spinner"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="autocomplete-popup" className="autocomplete-popup"></div>

        <div className="buildOrderOutput">
          <div className="form-container">
            <div className="form-left">
              <label htmlFor="buildCategoryDropdown" className="visually-hidden">
                Select Match-Up
              </label>
              <select
                id="buildCategoryDropdown"
                className="styled-dropdown"
                defaultValue=""
                onChange={handlePlaceholder}
              >
                <option value="" disabled>
                  Match-Up
                </option>
                <optgroup label="Zerg">
                  <option value="zvp">ZvP</option>
                  <option value="zvt">ZvT</option>
                  <option value="zvz">ZvZ</option>
                </optgroup>
                <optgroup label="Protoss">
                  <option value="pvp">PvP</option>
                  <option value="pvz">PvZ</option>
                  <option value="pvt">PvT</option>
                </optgroup>
                <optgroup label="Terran">
                  <option value="tvp">TvP</option>
                  <option value="tvt">TvT</option>
                  <option value="tvz">TvZ</option>
                </optgroup>
              </select>
            </div>

            <span id="buildOrderTitleText" contentEditable={false} tabIndex={0} className="dimmed">
              Enter build order title here...
            </span>

            <input
              type="text"
              id="buildOrderTitleInput"
              placeholder="Enter build order title here..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={handlePlaceholder}
            />

            <div className="form-right"></div>
          </div>

          <table id="buildOrderTable">
            <tbody>
              <tr>
                <th id="supplyHeader">
                  <span className="full-text">Supply/Time</span>
                  <span className="short-text">S/T</span>
                </th>
                <th className="action-header">
                  Action
                  <button id="openFocusModal" className="focus-btn" title="Focus Mode" onClick={handlePlaceholder}>
                    <img src="img/SVG/expand-top-right-svgrepo-com.svg" alt="Focus" />
                  </button>
                </th>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="row first-row">
          <div className="saveLoadContainer">
            <button id="saveBuildButton" data-tooltip="Save Current Build" onClick={handlePlaceholder}>
              <img src="img/SVG/save.svg" alt="Save Icon" className="svg-icon" />
              Save Build
            </button>
            <button id="newBuildButton" data-tooltip="Start New Build" onClick={handlePlaceholder}>
              <img src="img/SVG/plus.svg" alt="New Build Icon" className="svg-icon" />
              New Build
            </button>
            <button id="shareBuildButton" className="share-button" onClick={handlePlaceholder}>
              <img src="img/SVG/share.svg" alt="Share" className="svg-icon" />Share
            </button>
          </div>
        </div>

        <div className="main-layout">
          <h3 data-section="secondRow" className="toggle-title">
            <span className="arrow"></span> Additional Settings
          </h3>
          <div className="hideable-section hidden" id="secondRow">
            <div id="map-container">
              <div id="map-controls-row">
                <span id="selected-map-text">No map selected</span>

                <button
                  id="openMapModalButton"
                  className="menu-button"
                  data-tooltip="Map Selection"
                  onClick={handlePlaceholder}
                >
                  <img src="img/SVG/map-solid.svg" alt="Map Icon" className="svg-icon icon-20" />
                </button>
                <button
                  className="clear-annotations-button"
                  data-tooltip="Erase All"
                  onClick={handlePlaceholder}
                >
                  <img src="img/SVG/eraser-solid.svg" alt="Eraser Icon" className="svg-icon icon-20" />
                </button>
                <span
                  className="info-icon map-helper-icon"
                  data-tooltip="Click on map to add circles (position).&#10;Hold Left-click and drag to draw arrows."
                >
                  ?
                </span>
              </div>

              <div id="map-preview-container" className="map-preview">
                <img id="map-preview-image" className="map-image" src="" alt="Map Preview" />
                <div id="map-annotations" className="annotations"></div>
              </div>
            </div>

            <div className="comment-video-container">
              <h3 className="toggle-title">Replay</h3>

              <div id="replayInputWrapper">
                <a href="https://drop.sc/upload" target="_blank" className="drop-sc-upload-btn" rel="noreferrer">
                  ⬆ Upload Replay to Drop.sc
                </a>
                <p>then →</p>
                <input type="url" id="replayLinkInput" placeholder="Paste Drop.sc replay URL here..." onChange={handlePlaceholder} />
              </div>
              <div className="margin-bottom-10">
                <input type="file" id="replayFileInput" accept=".SC2Replay" onChange={handlePlaceholder} />
              </div>

              <div id="replayViewWrapper">
                <a id="replayDownloadBtn" href="#" target="_blank" className="download-replay-link" rel="noreferrer">
                  Download Replay on Drop.sc
                </a>
              </div>

              <h3 className="toggle-title">Comment</h3>
              <textarea id="commentInput" placeholder="Add a comment..." onChange={handlePlaceholder}></textarea>

              <h3 className="toggle-title">Video</h3>
              <input type="text" id="videoInput" placeholder="Paste YouTube link here..." onChange={handlePlaceholder} />
              <iframe
                id="videoIframe"
                title="YouTube video player"
                width="560"
                height="315"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>

        <div id="templateModal" className="modal">
          <div className="modal-content-template">
            <div className="template-header">
              <span className="close-modal" id="closeTemplateModal">
                &times;
              </span>
              <h3>Templates</h3>
              <div id="templateHeaderControls" className="header-controls">
                <input
                  id="templateSearchBar"
                  type="text"
                  placeholder="Search templates..."
                  className="search-bar"
                  onChange={handlePlaceholder}
                />
                <div id="templateFilters">
                  <div className="filters-wrapper">
                    <div className="filter-category" data-category="all" onClick={handlePlaceholder}>
                      All
                    </div>
                    <div className="filter-category" data-category="Zerg" onClick={handlePlaceholder}>
                      Z
                    </div>
                    <div className="filter-category" data-category="Protoss" onClick={handlePlaceholder}>
                      P
                    </div>
                    <div className="filter-category" data-category="Terran" onClick={handlePlaceholder}>
                      T
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="template-content-container">
              <div id="templatePreview">
                <h4>Template Preview</h4>
                <p>Select a template to view details here.</p>
              </div>
              <div className="template-list" id="templateList"></div>
            </div>
          </div>
        </div>

        <div id="saveTemplateModal" className="modal">
          <div className="modal-content">
            <span id="closeSaveTemplateModal" className="close-modal">
              &times;
            </span>
            <h3>Save Template</h3>
            <div>
              <label htmlFor="templateTitleInput">Template Title:</label>
              <input type="text" id="templateTitleInput" onChange={handlePlaceholder} />
            </div>
            <div>
              <label htmlFor="templateCategorySelect">Match-Up:</label>
              <select id="templateCategorySelect" className="styled-dropdown" defaultValue="" onChange={handlePlaceholder}>
                <option value="" disabled>
                  Select Match-Up
                </option>
                <option value="zvp">ZvP</option>
                <option value="zvt">ZvT</option>
                <option value="zvz">ZvZ</option>
                <option value="pvp">PvP</option>
                <option value="pvz">PvZ</option>
                <option value="pvt">PvT</option>
                <option value="tvp">TvP</option>
                <option value="tvt">TvT</option>
                <option value="tvz">TvZ</option>
              </select>
            </div>
            <div className="modal-buttons">
              <button id="saveTemplateConfirmButton" className="confirm-button" onClick={handlePlaceholder}>
                Save Template
              </button>
              <button id="cancelSaveTemplateButton" className="cancel-button" onClick={handlePlaceholder}>
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div id="communityModal" className="modal">
          <div className="modal-content-template">
            <div className="template-header">
              <span className="close-modal" id="closeCommunityModal">
                &times;
              </span>
              <h3>Community Builds</h3>
              <div id="communityHeaderControls" className="header-controls">
                <div className="community-type-toggle">
                  <button id="filterPublicBtn" className="community-type-btn active" data-type="public" onClick={handlePlaceholder}>
                    Public
                  </button>
                  <button id="filterClanBtn" className="community-type-btn" data-type="clan" onClick={handlePlaceholder}>
                    Clan
                  </button>
                </div>
                <input
                  id="communitySearchBar"
                  type="text"
                  placeholder="Search community builds..."
                  className="search-bar"
                  onChange={handlePlaceholder}
                />
                <div className="filters-container">
                  <div className="filters-wrapper">
                    <div className="filter-category" data-category="all" onClick={handlePlaceholder}>
                      All
                    </div>
                    <div className="filter-category" data-category="Zerg">
                      Z
                      <div className="submenu">
                        <div className="subcategory" data-subcategory="ZvZ" onClick={handlePlaceholder}>
                          ZvZ
                        </div>
                        <div className="subcategory" data-subcategory="ZvP" onClick={handlePlaceholder}>
                          ZvP
                        </div>
                        <div className="subcategory" data-subcategory="ZvT" onClick={handlePlaceholder}>
                          ZvT
                        </div>
                      </div>
                    </div>
                    <div className="filter-category" data-category="Protoss">
                      P
                      <div className="submenu">
                        <div className="subcategory" data-subcategory="PvZ" onClick={handlePlaceholder}>
                          PvZ
                        </div>
                        <div className="subcategory" data-subcategory="PvP" onClick={handlePlaceholder}>
                          PvP
                        </div>
                        <div className="subcategory" data-subcategory="PvT" onClick={handlePlaceholder}>
                          PvT
                        </div>
                      </div>
                    </div>
                    <div className="filter-category" data-category="Terran">
                      T
                      <div className="submenu">
                        <div className="subcategory" data-subcategory="TvZ" onClick={handlePlaceholder}>
                          TvZ
                        </div>
                        <div className="subcategory" data-subcategory="TvP" onClick={handlePlaceholder}>
                          TvP
                        </div>
                        <div className="subcategory" data-subcategory="TvT" onClick={handlePlaceholder}>
                          TvT
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="community-sort-wrapper">
                  <label htmlFor="communitySortDropdown" className="sort-label">
                    Sort by:
                  </label>
                  <select
                    id="communitySortDropdown"
                    className="styled-dropdown"
                    defaultValue="hot"
                    onChange={handlePlaceholder}
                  >
                    <option value="hot">Hot</option>
                    <option value="top">Top</option>
                    <option value="new">New</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="template-content-container">
              <div className="community-layout">
                <div id="buildCount" className="build-count">
                  0 builds
                </div>
                <div id="communityBuildPreview" className="build-preview">
                  <h4>Build Preview</h4>
                  <p>Hover over a build to preview details.</p>
                </div>
                <div id="communityBuildsContainer" className="community-list"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="clanModal" className="modal">
          <div className="modal-content-template">
            <div className="template-header">
              <span className="close-modal" id="closeClanModal">
                &times;
              </span>
              <h3>Clans</h3>

              <div className="clan-main-tabs">
                <button id="createClanBtn" className="clan-main-tab-button" data-view="create" onClick={handlePlaceholder}>
                  Create Clan
                </button>
                <button id="manageClanBtn" className="clan-main-tab-button" data-view="manage" onClick={handlePlaceholder}>
                  Manage Clan
                </button>
                <button id="findClanBtn" className="clan-main-tab-button" data-view="find" onClick={handlePlaceholder}>
                  Find a Clan
                </button>
              </div>
            </div>

            <div className="clan-views">
              <div id="createClanView" className="clan-subview"></div>

              <div id="manageClanView" className="clan-subview">
                <div className="clan-tabs">
                  <button className="clan-tab-button" data-tab="members" onClick={handlePlaceholder}>
                    Members
                  </button>
                  <button className="clan-tab-button" data-tab="requests" onClick={handlePlaceholder}>
                    Requests
                  </button>
                  <button className="clan-tab-button" data-tab="settings" onClick={handlePlaceholder}>
                    Settings
                  </button>
                </div>
                <div id="chooseManageClanView" className="clan-subview"></div>

                <div className="clan-tab-content" id="clan-members-tab"></div>
                <div className="clan-tab-content" id="clan-requests-tab"></div>
                <div className="clan-tab-content" id="clan-settings-tab"></div>
              </div>

              <div id="findClanView" className="clan-subview"></div>
              <div id="viewClanPage" className="clan-subview"></div>
            </div>
          </div>
        </div>

        <div id="publishModal" className="modal">
          <div className="modal-content small-modal">
            <h2>Publish Build</h2>
            <p>Where would you like to publish this build?</p>
            <hr className="publish-divider" />

            <div className="publish-status-list">
              <div className="publish-checkbox-row">
                <span className="label-community">Community</span>
                <div className="checkbox-wrapper-59">
                  <label className="switch">
                    <input type="checkbox" id="publishToCommunity" onChange={handlePlaceholder} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              <hr className="publish-divider" />
              <p className="modal-section-label">
                <span className="label-clans">Clan</span>
              </p>
              <div id="clanPublishList" className="publish-checkbox-list"></div>
            </div>

            <div className="modal-buttons">
              <button id="savePublishSettingsButton" className="confirm-button" onClick={handlePlaceholder}>
                Save Settings
              </button>
              <button id="closePublishModalButton" className="cancel-button" onClick={handlePlaceholder}>
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div id="settingsModal" className="modal">
          <div className="modal-content small-modal">
            <span className="close-modal" id="closeSettingsModal">
              &times;
            </span>
            <h3>Settings</h3>
            <div className="publish-checkbox-row">
              <span>Enable Bracket Input</span>
              <div className="checkbox-wrapper-59">
                <label className="switch">
                  <input type="checkbox" id="bracketInputToggle" defaultChecked onChange={handlePlaceholder} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            <div className="publish-checkbox-row">
              <span>Show Build Input</span>
              <div className="checkbox-wrapper-59">
                <label className="switch">
                  <input type="checkbox" id="buildInputToggle" defaultChecked onChange={handlePlaceholder} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            <div className="publish-checkbox-row">
              <span>Main Clan</span>
              <select id="mainClanSelect" className="styled-dropdown" defaultValue="" onChange={handlePlaceholder}></select>
            </div>
          </div>
        </div>

        <div id="userStatsModal" className="modal">
          <div className="modal-content small-modal">
            <span className="close-modal" id="closeUserStatsModal">
              &times;
            </span>
            <h3>My Stats</h3>
            <div id="userStatsContent">Loading...</div>
          </div>
        </div>

        <div id="deleteConfirmationModal" className="modal">
          <div className="modal-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this build?</p>
            <div className="modal-actions">
              <button id="confirmDeleteButton" className="btn btn-danger" onClick={handlePlaceholder}>
                Yes
              </button>
              <button id="cancelDeleteButton" className="btn" onClick={handlePlaceholder}>
                No
              </button>
            </div>
          </div>
        </div>

        <div id="deleteAccountModal" className="modal">
          <div className="modal-content">
            <h3>⚠️ Confirm Account Deletion</h3>
            <p>This will permanently delete your account and personal builds.</p>
            <div className="publish-checkbox-row">
              <span>Also delete my published community builds</span>
              <div className="checkbox-wrapper-59">
                <label className="switch">
                  <input
                    type="checkbox"
                    id="deleteCommunityBuildsCheckbox"
                    onChange={handlePlaceholder}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            <br />
            <br />
            <button id="confirmDeleteAccountButton" className="auth-button" onClick={handlePlaceholder}>
              Yes, Delete My Account
            </button>
            <button id="cancelDeleteAccountButton" className="auth-button" onClick={handlePlaceholder}>
              Cancel
            </button>
          </div>
        </div>

        <div id="replayOptionsModal" className="modal">
          <div className="modal-content small-modal">
            <span className="close-modal" id="closeReplayOptionsModal">
              &times;
            </span>
            <h3>Replay Options</h3>
            <div className="publish-checkbox-row">
              <span>Auto-fill build order from replay</span>
              <div className="checkbox-wrapper-59">
                <label className="switch">
                  <input type="checkbox" id="autoFillFromReplayToggle" defaultChecked onChange={handlePlaceholder} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            <div className="publish-checkbox-row">
              <span>Upload replay for sharing</span>
              <div className="checkbox-wrapper-59">
                <label className="switch">
                  <input type="checkbox" id="uploadReplayToggle" defaultChecked onChange={handlePlaceholder} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            <div className="modal-buttons">
              <button id="saveReplayOptionsButton" className="confirm-button" onClick={handlePlaceholder}>
                Save Options
              </button>
              <button id="cancelReplayOptionsButton" className="cancel-button" onClick={handlePlaceholder}>
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div id="focusModal" className="modal">
          <div className="modal-content">
            <span className="close-modal" id="closeFocusModal">
              &times;
            </span>
            <div className="font-controls">
              <button id="decreaseFontBtn" data-tooltip="Decrease font size" onClick={handlePlaceholder}>
                A-
              </button>
              <button id="increaseFontBtn" data-tooltip="Inscrease font size" onClick={handlePlaceholder}>
                A+
              </button>
            </div>
            <div id="focusContent" className="focus-content"></div>
          </div>
        </div>

        <div id="mapModal" className="modal">
          <div className="modal-content map-modal">
            <span className="close-modal" id="closeMapModal">
              &times;
            </span>
            <h3>Select Map</h3>
            <div className="map-modal-content">
              <div className="map-modal-sidebar">
                <input
                  type="text"
                  id="mapSearchInput"
                  placeholder="Search maps..."
                  className="search-bar"
                  onChange={handlePlaceholder}
                />
                <div className="map-filters">
                  <button className="filter-btn active" data-filter="all" onClick={handlePlaceholder}>
                    All Maps
                  </button>
                  <button className="filter-btn" data-filter="ladder" onClick={handlePlaceholder}>
                    Ladder
                  </button>
                  <button className="filter-btn" data-filter="custom" onClick={handlePlaceholder}>
                    Custom
                  </button>
                </div>
              </div>
              <div className="map-modal-gallery" id="mapGallery"></div>
            </div>
          </div>
        </div>

        <div id="supportersModal" className="modal">
          <div className="modal-content small-modal">
            <span className="close-modal" id="closeSupportersModal">
              &times;
            </span>
            <h3>Supporters</h3>
            <div id="supportersList"></div>
          </div>
        </div>

        <div id="myBuildsModal" className="modal">
          <div className="modal-content-template">
            <div className="template-header">
              <span className="close-modal" id="closeMyBuildsModal">
                &times;
              </span>
              <h3>My Builds</h3>
              <div className="header-controls">
                <input
                  id="myBuildsSearchBar"
                  type="text"
                  placeholder="Search your builds..."
                  className="search-bar"
                  onChange={handlePlaceholder}
                />
                <div className="filters-wrapper">
                  <div className="filter-category" data-category="all" onClick={handlePlaceholder}>
                    All
                  </div>
                  <div className="filter-category" data-category="favorites" onClick={handlePlaceholder}>
                    Favorites
                  </div>
                  <div className="filter-category" data-category="drafts" onClick={handlePlaceholder}>
                    Drafts
                  </div>
                </div>
                <div className="community-sort-wrapper">
                  <label htmlFor="myBuildsSortDropdown" className="sort-label">
                    Sort by:
                  </label>
                  <select
                    id="myBuildsSortDropdown"
                    className="styled-dropdown"
                    defaultValue="updated"
                    onChange={handlePlaceholder}
                  >
                    <option value="updated">Recently Updated</option>
                    <option value="created">Date Created</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="template-content-container">
              <div id="buildPreview">
                <h4>Build Preview</h4>
                <p>Select a build to view details here.</p>
              </div>
              <div className="template-list" id="buildList"></div>
              <div id="buildsLoadingWrapper">
                <div id="buildsLoadingIndicator" className="spinner"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="notification" className="notification">
          <p>
            Some image assets are owned by Blizzard Entertainment and are used according to
            <a href="http://blizzard.com/company/about/legal-faq.html" target="_blank" rel="noreferrer">
              Blizzard's Legal FAQ
            </a>
            .
          </p>
          <button id="closeNotification" onClick={handlePlaceholder}>
            ✖
          </button>
        </div>
      </div>

      <div className="footer">
        <div className="footer-left">
          <a href="#" id="legalNoticeLink" onClick={handlePlaceholder}>
            Privacy &amp; Legal Notice
          </a>
          <span className="divider">︱</span>
          <a
            href="https://discord.com/channels/801938615730307092/1340017869118902292"
            id="discordLink"
            target="_blank"
            rel="noreferrer"
          >
            Discord
          </a>
          <span className="divider">︱</span>
          <a
            href="https://patreon.com/zystem_official?utm_medium=unknown&amp;utm_source=join_link&amp;utm_campaign=creatorshare_creator&amp;utm_content=copyLink"
            id="patreonLink"
            target="_blank"
            rel="noreferrer"
          >
            Patreon
          </a>
          <span className="divider">︱</span>
          <a href="#" id="supportersLink" onClick={handlePlaceholder}>
            Support
          </a>
        </div>
        <div className="footer-right" id="site-info">
          <p>Version 0.5.8075</p>
        </div>

        <div id="cookieBanner" className="cookie-banner">
          <span>
            This site uses cookies for login and optional analytics. Learn more in our
            <a href="#" id="cookiePolicyLink" onClick={handlePlaceholder}>
              Privacy Policy
            </a>
            .
          </span>
          <button id="cookieAccept" className="cookie-btn" onClick={handlePlaceholder}>
            Accept
          </button>
          <button id="cookieDecline" className="cookie-btn" onClick={handlePlaceholder}>
            Decline
          </button>
        </div>
      </div>

      <div id="supportModal" className="modal">
        <div className="modal-content small-modal">
          <span className="close-modal" id="closeSupportModal">
            ×
          </span>
          <h3>Support Z-Build Order</h3>
          <div className="donate-buttons">
            <button
              id="koFiButton"
              className="ko-fi-button my-6 v-btn v-btn--block v-btn--is-elevated v-btn--has-bg v-btn--tile theme--dark v-size--large"
              onClick={handlePlaceholder}
            >
              <img src="img/SVG/kofi.svg" className="brand-icon" alt="Ko-fi" />Donate with Ko-fi
            </button>
            <a
              href="https://www.patreon.com/c/zystem_official"
              className="patreon-button my-6 v-btn v-btn--block v-btn--is-elevated v-btn--has-bg v-btn--tile theme--dark v-size--large"
              target="_blank"
              rel="noreferrer"
            >
              <img src="img/SVG/patreon.svg" className="brand-icon" alt="Patreon" />Become a Patron
            </a>
          </div>
          <h4>Past Donations</h4>
          <table id="donationsTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody id="donationsBody"></tbody>
          </table>
        </div>
      </div>

      <div id="privacyModal" className="modal">
        <div className="modal-content small-modal wide-privacy-modal">
          <span className="close-modal" id="closePrivacyModal">
            ×
          </span>
          <h3>Privacy &amp; Legal Notice</h3>

          <p>
            <strong>Last updated:</strong> June 12, 2025
          </p>

          <p>
            <strong>Z-Build Order</strong> is a personal tool designed for managing and sharing StarCraft II build orders. By
            using this tool, you agree to the terms outlined below:
          </p>

          <h4>1. Replay Files and External Links</h4>
          <p>
            Replay files are not uploaded or stored on this website. If you choose to share a replay, you must manually upload
            it to an external platform such as
            <a href="https://drop.sc/" target="_blank" rel="noreferrer">
              Drop.sc
            </a>
            , and paste the link into the app. These links are public and viewable by anyone with access.
          </p>
          <p>
            You are solely responsible for the content of any replay links you provide, and you confirm that you have the right
            to share those files publicly.
          </p>

          <h4>2. Account Data</h4>
          <p>
            Z-Build Order uses <strong>Firebase Authentication</strong> for user login. Only minimal information is stored, such
            as your unique user ID and display name. No passwords are stored by this site.
          </p>
          <p>
            Your builds are stored privately under your Firebase account unless you explicitly choose to publish them.
          </p>

          <h4>3. Cookies, Analytics and Local Storage</h4>
          <p>
            This site uses <strong>Firebase Authentication</strong>, which may rely on cookies or local browser storage to keep
            you signed in and secure. These cookies are necessary for login and session management and are not used for tracking
            or advertising.
          </p>
          <p>
            If you accept cookies, <strong>Firebase Analytics</strong> will load and collect aggregated usage data such as page
            views and button clicks. Declining cookies prevents analytics from running. Analytics information helps improve the
            app and does not include personally identifying data.
          </p>
          <p>
            <strong>Local storage</strong> is also used to remember your cookie choice, save build drafts and store other settings
            on your device.
          </p>

          <h4>4. Data Sharing</h4>
          <p>
            No personal data is sold or shared with third parties. Replay links may point to external services with their own
            privacy policies.
          </p>

          <h4>5. Liability Disclaimer</h4>
          <p>
            This app is provided “as is” without warranty of any kind. You use this site at your own risk. The owner of this
            site is not liable for any content you upload, link to, or view using this tool.
          </p>

          <h4>6. Contact</h4>
          <p>
            For any concerns or questions, please contact the developer directly.
          </p>
        </div>
      </div>
    </main>
  );
}
