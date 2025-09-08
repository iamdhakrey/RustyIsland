import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClock,
    faMicrochip,
    faMemory,
    faTimes,
    faGripVertical,
    faDesktop,
    faChartBar,
    faSpinner
} from '@fortawesome/free-solid-svg-icons';
import './DynamicIsland.css';

interface SystemInfo {
    cpu_usage: number;
    memory_usage: number;
    memory_total: number;
    time: string;
    active_processes: ProcessInfo[];
}

interface ProcessInfo {
    name: string;
    cpu_usage: number;
    memory: number;
}

type IslandMode = 'compact' | 'expanded' | 'activity';

const DynamicIsland: React.FC = () => {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [islandMode, setIslandMode] = useState<IslandMode>('compact');
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasDragged, setHasDragged] = useState(false);

    useEffect(() => {
        const fetchSystemInfo = async () => {
            try {
                const info = await invoke<SystemInfo>('get_system_info');
                setSystemInfo(info);
            } catch (error) {
                console.error('Failed to fetch system info:', error);
            }
        };

        const ensureOnTop = async () => {
            try {
                await invoke('ensure_always_on_top');
            } catch (error) {
                console.error('Failed to ensure always on top:', error);
            }
        };

        // Initial fetch
        fetchSystemInfo();
        ensureOnTop();

        // Update system info every 2 seconds
        const interval = setInterval(fetchSystemInfo, 2000);

        // Ensure always on top every 5 seconds
        const onTopInterval = setInterval(ensureOnTop, 5000);

        return () => {
            clearInterval(interval);
            clearInterval(onTopInterval);
        };
    }, []);

    const handleClick = async () => {
        // Don't expand if we just finished dragging
        if (hasDragged) {
            setHasDragged(false);
            return;
        }

        if (islandMode === 'compact') {
            setIslandMode('expanded');
            setIsExpanded(true);

            try {
                await invoke('update_window_size', {
                    width: 420,
                    height: 420
                });
            } catch (error) {
                console.error('Failed to update window size:', error);
            }
        } else {
            setIslandMode('compact');
            setIsExpanded(false);

            try {
                await invoke('update_window_size', {
                    width: 320,
                    height: 40
                });
            } catch (error) {
                console.error('Failed to update window size:', error);
            }
        }
    };

    const handleMouseDown = async (e: React.MouseEvent) => {
        // Don't start drag on close button
        if ((e.target as HTMLElement).closest('.close-btn')) {
            return;
        }

        const startX = e.clientX;
        const startY = e.clientY;
        let dragStarted = false;

        const handleMouseMove = (event: MouseEvent) => {
            const deltaX = Math.abs(event.clientX - startX);
            const deltaY = Math.abs(event.clientY - startY);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Only start dragging if we've moved beyond the threshold
            if (!dragStarted && distance > 5) {
                dragStarted = true;
                setIsDragging(true);
                setHasDragged(true);

                console.log('Starting window drag');
                invoke('start_drag').catch(error => {
                    console.error('Failed to start window drag:', error);
                });
            }
        };

        const handleMouseUp = () => {
            if (dragStarted) {
                // Reset drag state after a short delay
                setTimeout(() => {
                    setIsDragging(false);
                }, 100);
            } else {
                // If we didn't drag, it's a click
                setHasDragged(false);
            }

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const formatBytes = (bytes: number): string => {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const renderCompactMode = () => (
        <div className="island-content compact">
            <div className="time-display">
                <FontAwesomeIcon icon={faClock} className="icon" />
                {systemInfo?.time || '--:--'}
            </div>
            <div className="system-indicators">
                <div className="cpu-indicator">
                    <FontAwesomeIcon icon={faMicrochip} className="indicator-icon" />
                    <span className="indicator-value">
                        {systemInfo?.cpu_usage?.toFixed(0) || 0}%
                    </span>
                </div>
                <div className="memory-indicator">
                    <FontAwesomeIcon icon={faMemory} className="indicator-icon" />
                    <span className="indicator-value">
                        {systemInfo ? ((systemInfo.memory_usage / systemInfo.memory_total) * 100).toFixed(0) : 0}%
                    </span>
                </div>
                <div className="drag-indicator">
                    <FontAwesomeIcon icon={faGripVertical} className="drag-icon" />
                </div>
            </div>
        </div>
    );

    const renderExpandedMode = () => (
        <div className="island-content expanded">
            <div className="expanded-header">
                <div className="time-display large">
                    <FontAwesomeIcon icon={faClock} className="icon" />
                    {systemInfo?.time || '--:--'}
                </div>
                <button
                    className="close-btn"
                    onClick={async (e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                        setIslandMode('compact');

                        try {
                            await invoke('update_window_size', {
                                width: 320,
                                height: 40
                            });
                        } catch (error) {
                            console.error('Failed to update window size:', error);
                        }
                    }}
                >
                    <FontAwesomeIcon icon={faTimes} className="close-icon" />
                </button>
            </div>

            <div className="system-stats">
                <div className="stat-item cpu-stat">
                    <div className="stat-header">
                        <FontAwesomeIcon icon={faMicrochip} className="stat-icon" />
                        <span className="stat-label">CPU Usage</span>
                        <div className="stat-bar">
                            <div
                                className="stat-fill cpu-fill"
                                style={{ width: `${systemInfo?.cpu_usage || 0}%` }}
                            ></div>
                        </div>
                        <span className="stat-value">{systemInfo?.cpu_usage?.toFixed(1) || 0}%</span>
                    </div>
                </div>

                <div className="stat-item memory-stat">
                    <div className="stat-header">
                        <FontAwesomeIcon icon={faMemory} className="stat-icon" />
                        <span className="stat-label">Memory</span>
                        <div className="stat-bar">
                            <div
                                className="stat-fill memory-fill"
                                style={{ width: `${systemInfo ? (systemInfo.memory_usage / systemInfo.memory_total) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <span className="stat-value">
                            {systemInfo ? ((systemInfo.memory_usage / systemInfo.memory_total) * 100).toFixed(1) : 0}%
                        </span>
                    </div>
                </div>
            </div>

            {systemInfo?.active_processes && systemInfo.active_processes.length > 0 && (
                <div className="processes">
                    <div className="processes-header">
                        {/* <FontAwesomeIcon icon={faChartBar} className="processes-icon" /> */}
                        <h4 className="processes-title">Active Processes</h4>
                    </div>
                    <div className="process-list">
                        {systemInfo.active_processes.slice(0, 4).map((process, index) => (
                            <div key={index} className="process-item">
                                <div className="process-info">
                                    <FontAwesomeIcon icon={faDesktop} className="process-icon" />
                                    <span className="process-name">{process.name}</span>
                                </div>
                                <div className="process-stats">
                                    <span className="process-cpu">{process.cpu_usage.toFixed(1)}%</span>
                                    <span className="process-memory">{formatBytes(process.memory)}</span>
                                    <button className="process-close-btn">x</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    if (!systemInfo) {
        return (
            <div className="dynamic-island compact loading">
                <div className="loading-content">
                    <FontAwesomeIcon icon={faSpinner} className="loading-icon fa-spin" />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`dynamic-island ${islandMode} ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {islandMode === 'compact' ? renderCompactMode() : renderExpandedMode()}
        </div>
    );
};

export default DynamicIsland;
