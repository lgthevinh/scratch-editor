import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import {Key} from 'selenium-webdriver';

const SLEEP_TIME = 50;

const {
    findByXpath,
    getDriver,
    loadUri,
    clickKey,
    clickKeys
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const FILE_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="File"]]';
const EDIT_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="Edit"]]';
const SETTINGS_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "settings-menu_dropdown-label")]//*[text()="Settings"]]';

/* Notes:
    - Might need to change in case menus/submenus are moved around/reordered
    - Added sleep time to ensure consistency between different keyboard events
*/
describe('Menu bar keyboard navigation', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    beforeEach(async () => {
        await loadUri(uri);
    });

    test('Pressing Tab navigates through the menu items', async () => {
        // Pressing tab 3 times should focus the file menu button
        await clickKey(Key.TAB);
        let activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Home');

        await clickKey(Key.TAB);
        activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Settings menu');

        await clickKey(Key.TAB);
        activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('File menu');

        await clickKey(Key.TAB);
        activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Edit menu');
    });
 
    test('Enter opens File menu', async () => {
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('false');

        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await clickKey(Key.ENTER);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('Space opens File menu', async () => {
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('false');

        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await clickKey(Key.SPACE);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('ArrowUp moves focus to the last item in file menu', async () => {
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await clickKey(Key.ENTER);

        // ArrowUp should go to last item
        await clickKey(Key.ARROW_UP);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Save to your computer');
    });
 
    test('Enter opens Edit menu', async () => {
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('false');

        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await clickKey(Key.ENTER);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('Space opens Edit menu', async () => {
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('false');

        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await clickKey(Key.SPACE);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('ArrowUp moves focus to the last item in edit menu', async () => {
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await clickKey(Key.ENTER);
        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('Restore');

        // ArrowUp should go to last item
        await clickKey(Key.ARROW_UP);

        const activeElement2 = await driver.switchTo().activeElement();
        const text2 = await activeElement2.getText();

        expect(text2).toBe('Turn on Turbo Mode');
    });

    test('ArrowDown twice moves focus back to the first item in edit menu', async () => {
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await clickKeys([Key.ENTER, Key.ARROW_DOWN, Key.ARROW_DOWN]);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Restore');
    });

    test('Enter opens the Language submenu', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.ENTER, Key.ENTER]);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('English');
    });

    test('Space opens the Language submenu', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.SPACE, Key.SPACE]);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('English');
    });

    test('ArrowRight opens the Language submenu', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.ENTER, Key.ARROW_RIGHT]);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('English');
    });

    test('ArrowLeft and Escape close the Language submenu', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.ENTER, Key.ARROW_RIGHT, Key.ARROW_LEFT]);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('Language');

        await clickKey(Key.ARROW_RIGHT);

        const activeElement2 = await driver.switchTo().activeElement();
        const text2 = await activeElement2.getText();
        expect(text2).toBe('English');

        await clickKey(Key.ESCAPE);
        const activeElement3 = await driver.switchTo().activeElement();
        const text3 = await activeElement3.getText();
        expect(text3).toBe('Language');
    });

    test('Tab closes the whole Settings menu', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.ENTER, Key.ENTER, Key.TAB]);
        
        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('File menu');
    });
    
    test('Tab closes the whole Settings menu after arrows nav', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Settings menu');
        
        await clickKey(Key.ENTER);
        const activeElement2 = await driver.switchTo().activeElement();
        expect(await activeElement2.getText()).toBe('Language');

        await clickKey(Key.ARROW_DOWN);
        const activeElement3 = await driver.switchTo().activeElement();
        expect(await activeElement3.getText()).toBe('Color Mode');

        await clickKey(Key.ENTER);
        const activeElement4 = await driver.switchTo().activeElement();
        expect(await activeElement4.getText()).toBe('Original');

        await clickKey(Key.TAB);
        const activeElement5 = await driver.switchTo().activeElement();
        expect(await activeElement5.getAttribute('aria-label')).toBe('File menu');
    });

    test('Tab closes File menu', async () => {
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await clickKeys([Key.ENTER, Key.TAB]);

        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Edit menu');
    });

    test('Shift+Tab closes Edit menu and goes back to File menu', async () => {
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await clickKey(Key.ENTER);
        await driver.actions()
            .keyDown(Key.SHIFT)
            .sendKeys(Key.TAB)
            .keyUp(Key.SHIFT)
            .perform();
        await driver.sleep(SLEEP_TIME);

        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('File menu');
    });

    test('Changing to RTL language should change ARROW_LEFT and ARROW_RIGHT behavior', async () => {
        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await driver.executeScript('arguments[0].focus()', settingsMenuButton);
        await clickKeys([Key.ENTER, Key.ARROW_RIGHT]);
        const persianMenuItem = await findByXpath(
            '//li[normalize-space(text())="فارسی"]'
        );
        await persianMenuItem.click();
        await clickKey(Key.ENTER);

        await clickKeys([Key.TAB, Key.TAB, Key.ENTER]);

        await clickKey(Key.ARROW_LEFT);
        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();
        expect(text).toBe('فارسی');
        // Suspiciously fragile logic, might need to
        // be altered in case of language option changes
        const englishMenuItem = await findByXpath('//li[text()="English"]');
        await englishMenuItem.click();

        await clickKeys([Key.TAB, Key.TAB]);
        const activeElement2 = await driver.switchTo().activeElement();
        expect(await activeElement2.getAttribute('aria-label')).toBe('Settings menu');
    });
});
