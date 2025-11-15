const importMap = {
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.181.1/examples/jsm/"
    }
};

const script = document.createElement('script');
script.type = 'importmap';
script.innerHTML = JSON.stringify(importMap);
document.head.appendChild(script);
