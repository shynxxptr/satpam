module.exports = {
    apps: [{
        name: "satpam-discord-bot",
        script: "./index.js",
        cwd: "./",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        env: {
            NODE_ENV: "production",
        },
        error_file: "./logs/pm2-error.log",
        out_file: "./logs/pm2-out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }]
};
