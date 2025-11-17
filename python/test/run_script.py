from fileinput import filename
import schedule
import time
import subprocess
import re  
import os  

#Function: Run each script in order, on 24/7 basis

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        month_number = match.group('month')
        day = match.group('day')
        year = match.group('year')
        return month_number, day, year
    return None, None, None

# Create a dictionary of months and their final days
final_days_of_month = {
    '01': 31, '02': 28, '03': 31, '04': 30,
    '05': 31, '06': 30, '07': 31, '08': 31,
    '09': 30, '10': 31, '11': 30, '12': 31
}

# Adjust for leap years in February
def is_leap_year(year):
    year = int(year)
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)

def check_end_of_month(filename):
    month, day, year = extract_info_from_filename(filename)
    if month in final_days_of_month:
        final_day = final_days_of_month[month]
        if month == '02' and is_leap_year(year):
            final_day = 29 
        return int(day) == final_day
    return False

def run_scraping_bot():
    subprocess.run(["python3", "getExcelInfo.py"])
    time.sleep(10)
    subprocess.run(["python3", "getPdfInfo.py"])
    time.sleep(10)
    subprocess.run(["python3", "getBe.py"])
    time.sleep(5)
    subprocess.run(["python3", "update.py"])
    time.sleep(10)
    subprocess.run(["python3", "upload_to_dashboard.py"])
    print("All Daily Scripts executed successfully.")

    # Check if today is the last day of the month
    # downloads_path = "downloads"
    # xls_files = [f for f in os.listdir(downloads_path) if f.endswith('.xls')]  
    # if xls_files:
    #     filename = os.path.join(downloads_path, xls_files[0]) 
    #     month, day, year = extract_info_from_filename(filename)
    #     print(f"It's {month}-{day}-{year}.")
    #     if check_end_of_month(filename):
    #         print("It's the end of the month. Running monthly scripts.")
    #         # subprocess.run(["python3", "downloadcsv.py"])  
    #         # time.sleep(10)
    #         # subprocess.run(["python3", "reportgenerator.py"])
    #         # time.sleep(10)
    #         # subprocess.run(["python3", "html2pdf.py"])  
    #         # time.sleep(10)
    #         # subprocess.run(["python3", "emailtohomes.py"])  
    #         print("Monthly scripts executed successfully and emails sent.")  

    # Clear downloads after daily scripts if not the end of the month
    # if not check_end_of_month(filename):
    #     subprocess.run(["/bin/bash", "clear_downloads.sh"])
    # else:
    #     # Clear downloads after monthly scripts
    #     subprocess.run(["/bin/bash", "clear_downloads.sh"])

# Directly run the scraping bot when the script is executed
run_scraping_bot()