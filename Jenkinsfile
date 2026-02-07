// ===========================================
// FreeSomnia Jenkins Pipeline
// ===========================================
// This pipeline builds, tests, and deploys FreeSomnia
//
// Required Jenkins plugins:
//   - Pipeline
//   - NodeJS Plugin
//   - SSH Agent Plugin (for remote deployment)
//   - Credentials Plugin
//
// Required credentials:
//   - deploy-ssh-key: SSH private key for deployment
//   - staging-env: Secret file with staging .env
//   - prod-env: Secret file with production .env
//
// Required tools:
//   - NodeJS 22 (configured in Jenkins Global Tool Configuration)

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        // Node.js tool name (must match Jenkins NodeJS installation name)
        NODEJS_HOME = tool name: 'NodeJS-22'
        PATH = "${NODEJS_HOME}/bin:${env.PATH}"

        // Application settings
        APP_NAME = 'freesomnia'
        DEPLOY_USER = 'freesomnia'
        DEPLOY_PATH = '/opt/freesomnia'

        // Deployment hosts (override in Jenkins configuration)
        STAGING_HOST = credentials('staging-host') ?: ''
        PROD_HOST = credentials('prod-host') ?: ''
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'prod'],
            description: 'Deployment environment'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip running tests'
        )
        booleanParam(
            name: 'FORCE_DEPLOY',
            defaultValue: false,
            description: 'Force deployment even if tests fail'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                }
                echo "Building commit ${env.GIT_COMMIT_SHORT} on branch ${env.GIT_BRANCH_NAME}"
            }
        }

        stage('Setup') {
            steps {
                sh '''
                    echo "Node version: $(node -v)"
                    echo "npm version: $(npm -v)"

                    # Install pnpm if not available
                    if ! command -v pnpm &> /dev/null; then
                        npm install -g pnpm
                    fi
                    echo "pnpm version: $(pnpm -v)"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Lint & Type Check') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            parallel {
                stage('Server Type Check') {
                    steps {
                        sh 'pnpm --filter @api-client/server exec tsc --noEmit'
                    }
                }
                stage('Web Type Check') {
                    steps {
                        sh 'pnpm --filter @api-client/web exec tsc --noEmit'
                    }
                }
                stage('Shared Type Check') {
                    steps {
                        sh 'pnpm --filter @api-client/shared exec tsc --noEmit'
                    }
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                script {
                    try {
                        sh 'pnpm test'
                    } catch (e) {
                        if (!params.FORCE_DEPLOY) {
                            throw e
                        }
                        echo "Tests failed but FORCE_DEPLOY is enabled, continuing..."
                    }
                }
            }
        }

        stage('Build') {
            steps {
                sh 'pnpm build'
            }
            post {
                success {
                    // Archive build artifacts
                    archiveArtifacts artifacts: 'apps/web/dist/**/*', fingerprint: true
                    archiveArtifacts artifacts: 'apps/server/dist/**/*', fingerprint: true
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                expression { return params.ENVIRONMENT == 'staging' }
            }
            steps {
                script {
                    deployToServer(
                        host: env.STAGING_HOST,
                        credentialsId: 'deploy-ssh-key',
                        envCredentialsId: 'staging-env'
                    )
                }
            }
        }

        stage('Deploy to Production') {
            when {
                expression { return params.ENVIRONMENT == 'prod' }
            }
            steps {
                // Manual approval for production
                input message: 'Deploy to production?', ok: 'Deploy'

                script {
                    deployToServer(
                        host: env.PROD_HOST,
                        credentialsId: 'deploy-ssh-key',
                        envCredentialsId: 'prod-env'
                    )
                }
            }
        }

        stage('Health Check') {
            when {
                expression { return params.ENVIRONMENT in ['staging', 'prod'] }
            }
            steps {
                script {
                    def host = params.ENVIRONMENT == 'prod' ? env.PROD_HOST : env.STAGING_HOST
                    def maxRetries = 10
                    def retryCount = 0
                    def healthy = false

                    while (retryCount < maxRetries && !healthy) {
                        try {
                            sh "curl -sf http://${host}:3000/api/health"
                            healthy = true
                        } catch (e) {
                            retryCount++
                            echo "Health check attempt ${retryCount}/${maxRetries} failed, retrying..."
                            sleep 5
                        }
                    }

                    if (!healthy) {
                        error "Health check failed after ${maxRetries} attempts"
                    }
                    echo "Health check passed!"
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            script {
                if (params.ENVIRONMENT in ['staging', 'prod']) {
                    echo "Deployment successful to ${params.ENVIRONMENT}"
                    // Optionally send notification (Slack, email, etc.)
                    // slackSend(color: 'good', message: "FreeSomnia deployed to ${params.ENVIRONMENT}")
                }
            }
        }
        failure {
            script {
                echo "Build/deployment failed"
                // Optionally send notification
                // slackSend(color: 'danger', message: "FreeSomnia build failed: ${env.BUILD_URL}")
            }
        }
    }
}

// ===========================================
// Helper Functions
// ===========================================
def deployToServer(Map config) {
    def host = config.host
    def credentialsId = config.credentialsId
    def envCredentialsId = config.envCredentialsId

    if (!host) {
        error "Deployment host not configured"
    }

    // Create deployment package
    sh '''
        tar -czf /tmp/freesomnia-deploy.tar.gz \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='*.db' \
            --exclude='*.db-journal' \
            --exclude='.env' \
            --exclude='.env.local' \
            .
    '''

    sshagent(credentials: [credentialsId]) {
        // Upload package
        sh "scp /tmp/freesomnia-deploy.tar.gz ${env.DEPLOY_USER}@${host}:/tmp/"

        // Upload env file
        withCredentials([file(credentialsId: envCredentialsId, variable: 'ENV_FILE')]) {
            sh "scp \$ENV_FILE ${env.DEPLOY_USER}@${host}:/tmp/freesomnia.env"
        }

        // Execute deployment
        sh """
            ssh ${env.DEPLOY_USER}@${host} 'bash -s' << 'DEPLOY_SCRIPT'
                set -e

                # Stop service
                sudo systemctl stop freesomnia || true

                # Backup current deployment
                if [ -d "${env.DEPLOY_PATH}" ]; then
                    sudo cp -r ${env.DEPLOY_PATH} ${env.DEPLOY_PATH}.backup-\$(date +%Y%m%d-%H%M%S)
                fi

                # Extract new deployment
                sudo mkdir -p ${env.DEPLOY_PATH}
                sudo tar -xzf /tmp/freesomnia-deploy.tar.gz -C ${env.DEPLOY_PATH}
                sudo cp /tmp/freesomnia.env ${env.DEPLOY_PATH}/.env
                sudo chown -R ${env.DEPLOY_USER}:${env.DEPLOY_USER} ${env.DEPLOY_PATH}
                sudo chmod 600 ${env.DEPLOY_PATH}/.env

                # Install production dependencies
                cd ${env.DEPLOY_PATH}
                pnpm install --frozen-lockfile --prod

                # Run migrations
                pnpm --filter @api-client/server prisma migrate deploy

                # Start service
                sudo systemctl start freesomnia

                # Cleanup
                rm -f /tmp/freesomnia-deploy.tar.gz /tmp/freesomnia.env

                echo "Deployment complete"
DEPLOY_SCRIPT
        """
    }

    // Cleanup local package
    sh 'rm -f /tmp/freesomnia-deploy.tar.gz'
}
