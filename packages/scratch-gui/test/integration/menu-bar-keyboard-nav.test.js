import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import {Key} from 'selenium-webdriver';

const SLEEP_TIME = 500;

const {
    findByXpath,
    getDriver,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const FILE_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="File"]]';
const EDIT_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "menu-bar_collapsible-label")]//*[text()="Edit"]]';
const SETTINGS_MENU_XPATH = '//button[contains(@class, "menu-bar_menu-bar-item")]' +
    '[*[contains(@class, "settings-menu_dropdown-label")]//*[text()="Settings"]]';

describe('Menu bar keyboard navigation', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.executeScript('document.activeElement.blur()');
        await driver.quit();
    });

    beforeEach(async () => {
        await loadUri(uri);
    });

    test('Tab focuses file menu on 3 clicks', async () => {
        await loadUri(uri);

        // Pressing tab 3 times should focus the file menu button
        await driver.actions().sendKeys(Key.TAB, Key.TAB, Key.TAB)
            .perform();

        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('File menu');
    });
 
    test('Enter opens File menu', async () => {
        await loadUri(uri);
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('false');

        // Explicit keyboard focus
        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await driver.actions().sendKeys(Key.ENTER)
            .perform();

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('Space opens File menu', async () => {
        await loadUri(uri);
        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('false');

        // Explicit keyboard focus
        await driver.executeScript('arguments[0].focus()', fileMenuButton);
        await driver.actions().sendKeys(Key.SPACE)
            .perform();

        expect(await fileMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('ArrowUp moves focus to the last item', async () => {
        await loadUri(uri);

        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);
        await fileMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.sleep(SLEEP_TIME);

        // ArrowUp should go to last item
        await driver.actions().sendKeys(Key.ARROW_UP)
            .perform();
        await driver.sleep(SLEEP_TIME);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Save to your computer');
    });
 
    test('Enter opens Edit menu', async () => {
        await loadUri(uri);
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('false');

        // Explicit keyboard focus
        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await driver.actions().sendKeys(Key.ENTER)
            .perform();

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('Space opens Edit menu', async () => {
        await loadUri(uri);
        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('false');

        // Explicit keyboard focus
        await driver.executeScript('arguments[0].focus()', editMenuButton);
        await driver.actions().sendKeys(Key.SPACE)
            .perform();

        expect(await editMenuButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('ArrowUp moves focus to the last item in edit menu', async () => {
        await loadUri(uri);

        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);
        await editMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();

        // ArrowUp should go to last item
        await driver.actions().sendKeys(Key.ARROW_UP)
            .perform();

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Turn on Turbo Mode');
    });

    test('ArrowDown twice moves focus back to the first item in edit menu', async () => {
        await loadUri(uri);

        const editMenuButton = await findByXpath(EDIT_MENU_XPATH);
        await editMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.sleep(SLEEP_TIME);

        // ArrowUp should go to last item
        await driver.actions().sendKeys(Key.ARROW_DOWN, Key.ARROW_DOWN)
            .perform();
        await driver.sleep(SLEEP_TIME);

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Restore');
    });

    test('Enter, Space and ArrowRight opens the Language submenu', async () => {
        await loadUri(uri);

        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await settingsMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('English');

        await settingsMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.actions().sendKeys(Key.SPACE)
            .perform();

        expect(text).toBe('English');

        await settingsMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.actions().sendKeys(Key.ARROW_RIGHT)
            .perform();

        expect(text).toBe('English');
    });

    test('ArrowLeft and Escape close the Language submenu', async () => {
        await loadUri(uri);

        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await settingsMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER)
            .perform();

        await driver.actions().sendKeys(Key.ARROW_RIGHT)
            .perform();
        await driver.actions().sendKeys(Key.ARROW_LEFT)
            .perform();

        const activeElement = await driver.switchTo().activeElement();
        const text = await activeElement.getText();

        expect(text).toBe('Language');

        await driver.actions().sendKeys(Key.ARROW_RIGHT)
            .perform();
        await driver.actions().sendKeys(Key.ESCAPE)
            .perform();

        expect(text).toBe('Language');
    });

    test('Tab closes the whole Settings menu', async () => {
        await loadUri(uri);

        const settingsMenuButton = await findByXpath(SETTINGS_MENU_XPATH);
        await settingsMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER, Key.ENTER, Key.TAB)
            .perform();
        
        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('File menu');
    });
    
    test('Tab closes the whole Settings menu after arrows nav', async () => {
        await loadUri(uri);

        await driver.actions().sendKeys(Key.TAB, Key.TAB)
            .perform();
        await driver.sleep(SLEEP_TIME);
        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Settings menu');
        
        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.sleep(SLEEP_TIME);
        const activeElement2 = await driver.switchTo().activeElement();
        expect(await activeElement2.getText()).toBe('Language');

        await driver.actions().sendKeys(Key.ARROW_DOWN)
            .perform();
        await driver.sleep(SLEEP_TIME);
        const activateElement3 = await driver.switchTo().activeElement();
        expect(await activateElement3.getText()).toBe('Color Mode');

        await driver.actions().sendKeys(Key.ENTER)
            .perform();
        await driver.sleep(SLEEP_TIME);
        const activeElement4 = await driver.switchTo().activeElement();
        expect(await activeElement4.getText()).toBe('Original');

        await driver.actions().sendKeys(Key.TAB)
            .perform();
        await driver.sleep(SLEEP_TIME);
        const activeElement5 = await driver.switchTo().activeElement();
        expect(await activeElement5.getAttribute('aria-label')).toBe('File menu');
    });

    test('Tab closes File menu', async () => {
        await loadUri(uri);

        const fileMenuButton = await findByXpath(FILE_MENU_XPATH);
        await fileMenuButton.click();
        await driver.actions().sendKeys(Key.ENTER, Key.TAB)
            .perform();

        const activeElement = await driver.switchTo().activeElement();
        expect(await activeElement.getAttribute('aria-label')).toBe('Edit menu');

        await loadUri(uri);

        const fileMenuButton2 = await findByXpath(FILE_MENU_XPATH);
        await fileMenuButton2.click();
        await driver.actions().sendKeys(Key.ENTER, Key.ARROW_DOWN, Key.TAB)
            .perform();

        const activeElement2 = await driver.switchTo().activeElement();
        expect(await activeElement2.getAttribute('aria-label')).toBe('Edit menu');
    });
});
