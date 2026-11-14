import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import spiceypy as spice
import time

"""
    def prep_kernels()

    Load the necessary SPICE kernels for the mission.
"""
def prep_kernels ():
    spice.furnsh([
    # './ephermis_data_retreiver/required_kernels/naif0009.tls',
    './ephermis_data_retreiver/required_kernels/naif0012.tls',
    './ephermis_data_retreiver/required_kernels/de440s.bsp',
    # './ephermis_data_retreiver/required_kernels/cas00084.tsc',
    # './ephermis_data_retreiver/required_kernels/cpck05Mar2004.tpc',
    # './ephermis_data_retreiver/required_kernels/cas_v37.tf',
    # './ephermis_data_retreiver/required_kernels/cas_iss_v09.ti',
    # './ephermis_data_retreiver/required_kernels/020514_SE_SAT105.bsp',
    # './ephermis_data_retreiver/required_kernels/981005_PLTEPH-DE405S.bsp',
    # './ephermis_data_retreiver/required_kernels/030201AP_SK_SM546_T45.bsp'
    ])

"""
    def get_moon_position(time_viewed)

    takes a timestamp as an input 

    The function computes the position of Luna (Earth's Moon) at the timestamp being viewed in the application
    in order to anchor the earth, sun and mars in relation to the moon's position as the anchor.

    returns the position of the moon in a 3D coordinate system (x, y, z) at the given timestamp.
"""
def get_moon_position(time_viewed):
    estimated_time = spice.str2et(time_viewed)
    moon_position, _ = spice.spkpos('MOON', estimated_time, 'J2000', 'NONE', 'MOON')
    return moon_position

"""
    def get_earth_position(time_viewed)

    takes a timestamp as an input

    The function computes the position of Earth at the timestamp being viewed in the application
    in relation to Luna's position as the anchor.

    returns the position of the earth in a 3D coordinate system (x, y, z) at the given timestamp.
"""
def get_earth_position(time_viewed):
    estimated_time = spice.str2et(time_viewed)
    earth_position, _ = spice.spkpos('EARTH', estimated_time, 'J2000', 'NONE', 'MOON')
    return earth_position

"""
    def get_sun_position(time_viewed)

    takes a timestamp as an input

    The function computes the position of the Sun at the timestamp being viewed in the application
    in relation to Luna's position as the anchor.

    returns the position of the sun in a 3D coordinate system (x, y, z) at the given timestamp.
"""
def get_sun_position(time_viewed):
    estimated_time = spice.str2et(time_viewed)
    sun_position, _ = spice.spkpos('SUN', estimated_time, 'J2000', 'NONE', 'MOON')
    return sun_position

"""
    def get_mars_position(time_viewed)

    takes a timestamp as an input

    The function computes the position of Mars at the timestamp being viewed in the application
    in relation to Luna's position as the anchor.

    returns the position of Mars in a 3D coordinate system (x, y, z) at the given timestamp.
"""
def get_mars_position(time_viewed):
    estimated_time = spice.str2et(time_viewed)
    mars_position, _ = spice.spkpos('MARS BARYCENTER', estimated_time, 'J2000', 'NONE', 'MOON')
    return mars_position

def run_test():
    prep_kernels()
    time_viewed = time.strftime("%Y/%m/%d")
    moon_position = get_moon_position(time_viewed)
    earth_position = get_earth_position(time_viewed)
    sun_position = get_sun_position(time_viewed)
    mars_position = get_mars_position(time_viewed)

    print(f"Moon Position at {time_viewed}: {moon_position}")
    print(f"Earth Position at {time_viewed}: {earth_position}")
    print(f"Sun Position at {time_viewed}: {sun_position}")
    print(f"Mars Position at {time_viewed}: {mars_position}")

# run_test()