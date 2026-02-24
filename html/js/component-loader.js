/**
 * Component Loader for Baby Tracker
 * Loads HTML components dynamically and initializes the app
 */

class ComponentLoader {
    constructor(basePath = '') {
        this.basePath = basePath;
        this.components = new Map();
    }

    async loadComponent(name) {
        if (this.components.has(name)) {
            return this.components.get(name);
        }

        const url = `${this.basePath}components/${name}.html`;
        console.log(`Loading component: ${url}`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to load ${name}: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to load ${name}`);
            }
            const html = await response.text();
            this.components.set(name, html);
            console.log(`Loaded component: ${name}`);
            return html;
        } catch (error) {
            console.error(`Error loading component ${name}:`, error);
            return '';
        }
    }

    async loadComponents(componentNames) {
        const promises = componentNames.map(name => this.loadComponent(name));
        return Promise.all(promises);
    }

    injectComponent(name, targetId) {
        const html = this.components.get(name);
        if (html) {
            const target = document.getElementById(targetId);
            if (target) {
                target.innerHTML = html;
            }
        }
    }

    async initializeApp() {
        // Define component load order
        const headerComponents = ['tracker-header'];
        const mainComponents = [
            'speech-log',
            'dashboard-metrics', 
            'mobile-metrics',
            'summary-stats',
            'activity-log',
            'trend-section'
        ];
        const modalComponents = [
            'feed-modal',
            'susu-modal',
            'poti-modal',
            'temp-modal',
            'weight-modal',
            'speech-modal',
            'range-modal'
        ];

        // Load all components in parallel
        await this.loadComponents([...headerComponents, ...mainComponents, ...modalComponents]);

        // Inject header
        this.injectComponent('tracker-header', 'app-header');

        // Inject main content
        const mainContainer = document.getElementById('app-main');
        if (mainContainer) {
            mainContainer.innerHTML = [
                ...mainComponents.map(name => this.components.get(name))
            ].join('\n');
        }

        // Inject modals
        const modalContainer = document.getElementById('app-modals');
        if (modalContainer) {
            modalContainer.innerHTML = [
                ...modalComponents.map(name => this.components.get(name))
            ].join('\n');
        }

        // Initialize waveform bars dynamically
        this.initializeWaveformBars();
    }

    initializeWaveformBars() {
        // Generate waveform bars for speech modal
        const speechWaveform = document.getElementById('speech-waveform');
        if (speechWaveform) {
            speechWaveform.innerHTML = Array(16).fill(0).map(() => 
                '<div class="w-1 flex-1 max-w-[10px] bg-slate-200 rounded-full speech-bar"></div>'
            ).join('');
        }
    }
}

// Global instance - use 'html/' prefix like other resources (css, js)
window.componentLoader = new ComponentLoader('html/');

// Debug: show what's happening
console.log('ComponentLoader initialized, basePath:', window.componentLoader.basePath);

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.componentLoader.initializeApp().then(() => {
        // Dispatch event when components are loaded
        document.dispatchEvent(new CustomEvent('components-loaded'));
    });
});

export default ComponentLoader;
