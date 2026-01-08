import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5173/StudentDashboard", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input administrator credentials and log in.
        frame = context.pages[-1]
        # Input username (Número de Legajo)
        elem = frame.locator('xpath=html/body/div/div/main/div/div/div[2]/div/form/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('4227')
        

        frame = context.pages[-1]
        # Input password (Contraseña)
        elem = frame.locator('xpath=html/body/div/div/main/div/div/div[2]/div/form/div/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('422792')
        

        frame = context.pages[-1]
        # Click on 'Iniciar Sesión' button to log in
        elem = frame.locator('xpath=html/body/div/div/main/div/div/div[2]/div/form/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Locate and verify the Smart Analysis component for AI-driven insights, alerts, and recommendations.
        await page.mouse.wheel(0, await page.evaluate('() => window.innerHeight'))
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=¡Felicitaciones! Has completado todos los requisitos para tu acreditación.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Solicitar Acreditación').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=100%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=ESPECIALIDAD: CLINICA').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=ÁREAS ROTADAS').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=3').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=CONVOCATORIAS ABIERTAS').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Fundación Tiempo - PPS con Orientación Clínica Niños').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Fundación Tiempo - PPS con Orientación Clínica Adultos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ver Convocados').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sobre las Convocatorias').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Las convocatorias se abren y cierran según las necesidades de las instituciones. Si no ves una PPS de tu interés, ¡vuelve a consultar pronto! Las fechas y horarios son definidos por cada institución y no pueden modificarse.').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    