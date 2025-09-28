const { execSync } = require('child_process');

console.log('Installing OpenZeppelin contracts v5.4.0...');

try {
    // Force reinstall OpenZeppelin
    execSync('npm uninstall @openzeppelin/contracts', { stdio: 'inherit' });
    execSync('npm install @openzeppelin/contracts@^5.4.0', { stdio: 'inherit' });
    
    console.log('OpenZeppelin contracts installed successfully!');
    
    // Try to compile
    console.log('Attempting to compile contracts...');
    execSync('npx hardhat compile', { stdio: 'inherit' });
    
    console.log('Compilation successful!');
} catch (error) {
    console.error('Error during installation or compilation:', error.message);
    
    // If still failing, show detailed error
    console.log('Checking OpenZeppelin version...');
    try {
        execSync('npm list @openzeppelin/contracts', { stdio: 'inherit' });
    } catch (e) {
        console.log('Failed to check version');
    }
}